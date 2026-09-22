import React, { useState } from 'react';
import { Lightbulb, Sparkles, X, Check, Code2, ArrowRight, Layers, FileText } from 'lucide-react';
import { PRESET_RULE_TEMPLATES, type PresetTemplate } from '../../services/ontology/presetRuleTemplates';
import type { FeatureDefinition, RuleDefinition } from '../../services/ontology/ontologyInferenceEngine';

export interface PresetTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PresetTemplate) => void;
}

export const PresetTemplateModal: React.FC<PresetTemplateModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTemplateId, setActiveTemplateId] = useState<string>(PRESET_RULE_TEMPLATES[0].id);

  if (!isOpen) return null;

  const activeTemplate = PRESET_RULE_TEMPLATES.find(t => t.id === activeTemplateId) || PRESET_RULE_TEMPLATES[0];

  const filteredTemplates = selectedCategory === 'all'
    ? PRESET_RULE_TEMPLATES
    : PRESET_RULE_TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <div role="dialog" aria-modal="true" aria-label="特征组合典型示例模板库" tabIndex={-1} autoFocus onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="preset-template-modal flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-monokai-border bg-monokai-elevated shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border-subtle bg-monokai-surface px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-monokai-cyan/15 text-monokai-cyan border border-monokai-cyan/30">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-monokai-fg flex items-center gap-2">
                特征组合典型示例模板库
                <span className="rounded bg-monokai-yellow/10 px-2 py-0.5 text-[10px] text-monokai-yellow font-bold border border-monokai-yellow/30">4 大跨领域模式</span>
              </h2>
              <p className="text-xs text-monokai-comment">
                挑选启发性特征组合模板，自动推演生成标准化 Lisp AST 规则树与特征模型
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-monokai-comment transition-colors hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer"
            aria-label="关闭示例模板库"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="preset-template-body flex flex-1 overflow-hidden">
          
          {/* Left Sidebar: Categories & Template List */}
          <div className="preset-template-sidebar flex w-72 flex-col border-r border-monokai-border-subtle bg-monokai-sidebar p-4">
            
            {/* Category Pills */}
            <div className="mb-4 flex flex-wrap gap-1">
              {[
                { id: 'all', label: '全部' },
                { id: 'finance', label: '金融' },
                { id: 'ecommerce', label: '电商' },
                { id: 'supply_chain', label: '供应链' },
                { id: 'cybersecurity', label: '安全' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-monokai-surface text-monokai-fg border border-monokai-border-strong'
                      : 'bg-monokai-surface text-monokai-comment hover:bg-monokai-elevated border border-monokai-border-subtle'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Template List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {filteredTemplates.map(tpl => {
                const isActive = tpl.id === activeTemplateId;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setActiveTemplateId(tpl.id)}
                    className={`group w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-monokai-border-strong bg-monokai-surface shadow-xs'
                        : 'border-monokai-border-subtle bg-monokai-surface hover:border-monokai-border hover:bg-monokai-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-monokai-comment">{tpl.categoryLabel}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-monokai-cyan" />}
                    </div>
                    <div className="mt-1 font-bold text-xs text-monokai-fg group-hover:text-monokai-fg">
                      {tpl.name}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[10px] text-monokai-comment">
                      {tpl.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Template Preview & Details */}
          <div className="flex flex-1 flex-col overflow-y-auto bg-monokai-elevated p-6 space-y-5 custom-scrollbar">
            
            {/* Header info */}
            <div className="rounded-2xl border border-monokai-border bg-monokai-surface p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-monokai-cyan/15 px-3 py-1 text-xs font-bold text-monokai-cyan border border-monokai-cyan/30">
                  {activeTemplate.categoryLabel}
                </span>
                <span className="text-xs font-mono text-monokai-comment">
                  逻辑 ID: {activeTemplate.rule.logicalId}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black text-monokai-fg">{activeTemplate.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-monokai-fg-muted">{activeTemplate.description}</p>
            </div>

            {/* Chinese Lisp Representation */}
            <div className="rounded-2xl border border-monokai-border bg-monokai-sidebar p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-monokai-cyan">
                <Code2 className="h-4 w-4" /> 中文 Lisp 层级表达 (业务可读与统一 AST)
              </div>
              <pre className="overflow-x-auto rounded-xl bg-monokai-surface p-4 font-mono text-xs text-monokai-green leading-relaxed border border-monokai-border-subtle">
                {activeTemplate.lispCode}
              </pre>
            </div>

            {/* Human Explanation */}
            <div className="rounded-2xl border border-monokai-border bg-monokai-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-monokai-yellow">
                <Sparkles className="h-4 w-4" /> 自然语言业务判定逻辑
              </div>
              <p className="text-xs text-monokai-fg leading-relaxed bg-monokai-sidebar p-3 rounded-xl border border-monokai-border-subtle">
                {activeTemplate.explanation}
              </p>
            </div>

            {/* Sample Features included */}
            <div className="rounded-2xl border border-monokai-border bg-monokai-surface p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-monokai-fg">
                <Layers className="h-4 w-4 text-monokai-amethyst" /> 模板关联复合特征构件 ({activeTemplate.sampleFeatures.length} 个)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activeTemplate.sampleFeatures.map(feat => (
                  <div key={feat.id} className="rounded-xl border border-monokai-border-subtle bg-monokai-sidebar p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-monokai-green">{feat.name}</span>
                      <span className="rounded bg-monokai-surface px-1.5 py-0.5 text-[9px] text-monokai-comment font-mono border border-monokai-border-subtle">{feat.valueType}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-monokai-comment line-clamp-1">{feat.description}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-monokai-border-subtle bg-monokai-surface px-6 py-4">
          <div className="text-xs text-monokai-comment">
            点击“载入此模板”后将为您自动创建模板规则并带入全部特征构件
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-monokai-border bg-monokai-sidebar px-4 py-2 text-xs font-bold text-monokai-fg hover:bg-monokai-elevated cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                onSelectTemplate(activeTemplate);
                onClose();
              }}
              className="flex items-center gap-2 rounded-xl bg-monokai-cyan px-5 py-2 text-xs font-black text-monokai-bg transition-all hover:brightness-110 shadow-lg shadow-monokai-cyan/20 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> 载入此模板并编辑
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
