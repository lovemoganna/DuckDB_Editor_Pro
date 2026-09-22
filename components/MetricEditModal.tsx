import React, { useState, useEffect } from 'react';
import { MetricDefinition } from '../types';
import { Edit3, X, Check, Tag, Calculator, FileText, Layers, Hash } from 'lucide-react';
import { ActionButton, IconButton } from './ui/Workbench';

interface MetricEditModalProps {
  isOpen: boolean;
  metric: MetricDefinition | null;
  onClose: () => void;
  onSave: (metric: MetricDefinition) => void;
}

export const MetricEditModal: React.FC<MetricEditModalProps> = ({
  isOpen,
  metric,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<MetricDefinition | null>(null);

  useEffect(() => {
    if (metric) {
      setFormData({ ...metric });
    }
  }, [metric]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="编辑指标定义"
    >
      <div
        className="w-full max-w-2xl bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-monokai-border bg-monokai-sidebar/95">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-monokai-surface border border-monokai-border flex items-center justify-center text-monokai-fg-muted shrink-0">
              <Edit3 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
                编辑指标语义定义
                <span className="font-mono text-xs text-monokai-yellow px-2 py-0.5 rounded bg-monokai-surface border border-monokai-border font-semibold">
                  {formData.name}
                </span>
              </h2>
              <p className="text-xs text-monokai-comment mt-0.5">
                调整指标的计算公式、业务场景与元数据定义
              </p>
            </div>
          </div>
          <IconButton label="关闭" icon={X} onClick={onClose} size="sm" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-monokai-bg custom-scrollbar">
            {/* Top row: Name & Category & Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  指标标识 (Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs font-mono text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  业务分类 (Category)
                </label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  placeholder="例如: 营收类, 流量类"
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  计量单位 (Unit)
                </label>
                <input
                  type="text"
                  value={formData.unit || ''}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="元, %, 个, 人"
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs font-mono text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Formula box */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator size={13} className="text-monokai-green" />
                  DuckDB 计算公式 (SQL Formula) *
                </label>
                <span className="text-[10px] text-monokai-comment font-mono">聚合表达式或 CTE 结构</span>
              </div>
              <textarea
                required
                rows={3}
                value={formData.formula}
                onChange={e => setFormData({ ...formData, formula: e.target.value })}
                className="w-full bg-monokai-surface border border-monokai-border rounded-lg p-3 text-xs font-mono text-monokai-green focus:border-monokai-border-strong focus:outline-none transition-colors resize-none leading-relaxed"
                placeholder="例如: SUM(order_amount) 或 COUNT(DISTINCT user_id)"
              />
            </div>

            {/* Definition */}
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-monokai-cyan" />
                指标定义与业务口径
              </label>
              <textarea
                rows={2}
                value={formData.definition}
                onChange={e => setFormData({ ...formData, definition: e.target.value })}
                className="w-full bg-monokai-surface border border-monokai-border rounded-lg p-2.5 text-xs text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors resize-none leading-relaxed"
                placeholder="清晰描述该指标所表达的具体业务逻辑与统计边界"
              />
            </div>

            {/* 2-col: Scenario & Characteristics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  应用场景 (Scenario)
                </label>
                <input
                  type="text"
                  value={formData.scenario}
                  onChange={e => setFormData({ ...formData, scenario: e.target.value })}
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  指标特征 (Characteristics)
                </label>
                <input
                  type="text"
                  value={formData.characteristics}
                  onChange={e => setFormData({ ...formData, characteristics: e.target.value })}
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* 2-col: Value & Example */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  业务价值 (Value)
                </label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  典型案例数值 (Example)
                </label>
                <input
                  type="text"
                  value={formData.example}
                  onChange={e => setFormData({ ...formData, example: e.target.value })}
                  className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers size={13} className="text-monokai-yellow" />
                依赖字段列表 (Dependencies, 逗号分隔)
              </label>
              <input
                type="text"
                value={formData.dependencies?.join(', ') || ''}
                onChange={e => {
                  const deps = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  setFormData({ ...formData, dependencies: deps });
                }}
                placeholder="例如: created_at, order_amount, user_id"
                className="w-full bg-monokai-surface border border-monokai-border rounded-lg px-3 py-1.5 text-xs font-mono text-monokai-fg focus:border-monokai-border-strong focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-monokai-border bg-monokai-sidebar/95 flex items-center justify-end gap-2 shrink-0">
            <ActionButton variant="secondary" size="sm" onClick={onClose} type="button">
              取消
            </ActionButton>
            <ActionButton
              variant="success"
              size="sm"
              icon={Check}
              type="submit"
            >
              保存指标定义
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};
