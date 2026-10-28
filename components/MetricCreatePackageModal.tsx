import './metricUi.css';
import React, { useState, useEffect, useId } from 'react';
import { MetricPackage, MetricDefinition } from '../types';
import { PackagePlus, Check, Plus, Database, Sparkles, X } from 'lucide-react';
import { ActionButton, FormInput, FormTextarea, ModalShell } from './ui/Workbench';
import { METRIC_TEMPLATES } from './MetricTemplateModal';
import { toastService } from '../services/toastService';

interface MetricCreatePackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePackage: (pkg: MetricPackage) => void;
  availableTables: string[];
  existingPackageNames?: string[];
}

export const MetricCreatePackageModal: React.FC<MetricCreatePackageModalProps> = ({
  isOpen,
  onClose,
  onCreatePackage,
  availableTables = [],
  existingPackageNames = [],
}) => {
  const formId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [customTableInput, setCustomTableInput] = useState('');
  const [includeStarterTemplates, setIncludeStarterTemplates] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedTables(availableTables.length > 0 ? new Set([availableTables[0]]) : new Set());
      setCustomTableInput('');
      setIncludeStarterTemplates(false);
      setErrorMsg('');
    }
  }, [isOpen, availableTables]);

  if (!isOpen) return null;

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const handleAddCustomTable = () => {
    const trimmed = customTableInput.trim();
    if (!trimmed) return;
    setSelectedTables(prev => new Set(prev).add(trimmed));
    setCustomTableInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('请输入指标包名称');
      return;
    }

    if (existingPackageNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())) {
      setErrorMsg(`已存在同名指标包「${trimmedName}」，建议使用不同名称区分业务域`);
      return;
    }

    // Prepare initial metrics if starter templates are selected
    let initialMetrics: MetricDefinition[] = [];
    if (includeStarterTemplates) {
      const baseTemplates = METRIC_TEMPLATES.slice(0, 3);
      initialMetrics = baseTemplates.map(t => ({
        ...t,
        id: `metric_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    }

    const sourceTablesArray = Array.from(selectedTables);
    if (sourceTablesArray.length === 1) initialMetrics = initialMetrics.map(metric => ({ ...metric, sourceTable: sourceTablesArray[0] }));
    const now = Date.now();
    const newPackage: MetricPackage = {
      id: `pkg_${now}_${Math.random().toString(36).slice(2, 9)}`,
      name: trimmedName,
      description: description.trim(),
      sourceTables: sourceTablesArray,
      metrics: initialMetrics,
      createdAt: now,
      updatedAt: now,
    };

    onCreatePackage(newPackage);
    toastService.success(`指标包「${newPackage.name}」已创建`, initialMetrics.length > 0 ? `预置 ${initialMetrics.length} 个模板指标` : '空白指标包');
    onClose();
  };

  return (
    <ModalShell
      className="metric-surface"
      open={isOpen}
      onClose={onClose}
      title="手动新建指标包"
      description="创建自定义业务指标包并关联数据表，支持后续手动定义或从模板库导入指标"
      icon={PackagePlus}
      size="md"
      footer={
        <>
          <ActionButton variant="secondary" size="sm" onClick={onClose} type="button">
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            icon={Check}
            type="submit"
            form={formId}
          >
            创建指标包
          </ActionButton>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {/* Package Name */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-monokai-fg-muted">
            指标包名称 <span className="text-monokai-pink">*</span>
          </label>
          <FormInput
            aria-label="指标包名称"
            aria-required="true"
            aria-invalid={Boolean(errorMsg)}
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="例如: 电商零售核心指标包、用户活跃分析包"
            autoFocus
          />
          {errorMsg && (
            <p className="mt-1 text-xs text-monokai-pink" role="alert">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Source Tables Selection */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-monokai-fg-muted flex items-center gap-1.5">
              <Database size={13} className="text-monokai-comment" aria-hidden="true" />
              关联数据表 ({selectedTables.size} 个已选)
            </label>

            {availableTables.length > 0 && (
              <div className="flex items-center gap-2 text-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedTables(new Set(availableTables))}
                  className="text-monokai-accent hover:underline cursor-pointer"
                >
                  全选
                </button>
                <span className="text-monokai-border">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedTables(new Set())}
                  className="text-monokai-comment hover:text-monokai-fg cursor-pointer"
                >
                  清空
                </button>
              </div>
            )}
          </div>

          {availableTables.length > 0 ? (
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-monokai-border/80 bg-monokai-sidebar/50 p-2.5 custom-scrollbar">
              {availableTables.map(t => {
                const isSelected = selectedTables.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTable(t)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-xs transition-colors cursor-pointer border ${
                      isSelected
                        ? 'border-monokai-accent bg-monokai-surface text-monokai-fg shadow-2xs font-semibold'
                        : 'border-monokai-border/60 bg-monokai-bg/60 text-monokai-comment hover:text-monokai-fg hover:border-monokai-border'
                    }`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-monokai-accent' : 'bg-monokai-comment/50'}`} />
                    <span className="max-w-[160px] truncate" title={t}>{t}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-monokai-border bg-monokai-sidebar/30 p-3 text-center text-xs text-monokai-comment">
              当前工作区暂无物理表，可直接输入自定义表名进行关联
            </div>
          )}

          {/* Add custom table input */}
          {[...selectedTables].filter(table => !availableTables.includes(table)).length > 0 && <div className="mt-2 flex flex-wrap gap-2" aria-label="额外关联来源">
            {[...selectedTables].filter(table => !availableTables.includes(table)).map(table => <button key={table} type="button" onClick={() => toggleTable(table)} className="inline-flex max-w-full items-center gap-1 rounded-md border border-monokai-border bg-monokai-surface px-2 py-1 text-xs" aria-label={`移除来源 ${table}`}>
              <span className="truncate font-mono">{table}</span><X size={12} className="shrink-0" aria-hidden="true" />
            </button>)}
          </div>}
          <div className="mt-2 flex items-center gap-2">
            <FormInput
              aria-label="其他表名或视图名"
              fontVariant="mono"
              sizeVariant="sm"
              value={customTableInput}
              onChange={e => setCustomTableInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomTable();
                }
              }}
              placeholder="输入其他表名或视图名后按回车添加..."
              className="flex-1"
            />
            <ActionButton
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={handleAddCustomTable}
              disabled={!customTableInput.trim()}
            >
              添加
            </ActionButton>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-monokai-fg-muted">
            业务说明 (可选)
          </label>
          <FormTextarea
            aria-label="业务说明"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="说明此指标包的业务背景、统计口径、服务对象等..."
          />
        </div>

        {/* Starter Templates Option */}
        <div className="rounded-lg border border-monokai-border bg-monokai-sidebar/40 p-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={includeStarterTemplates}
              onChange={e => setIncludeStarterTemplates(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-monokai-border bg-monokai-surface text-monokai-accent focus:ring-monokai-accent"
            />
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
                <Sparkles size={12} className="text-monokai-yellow" aria-hidden="true" />
                预置通用统计模版指标
              </span>
              <p className="mt-0.5 text-meta leading-relaxed text-monokai-comment">
                添加记录数、去重数、求和 3 个口径草稿；需逐项绑定实际字段并验证，不含示例数据或已审核结论。
              </p>
            </div>
          </label>
        </div>
      </form>
    </ModalShell>
  );
};
