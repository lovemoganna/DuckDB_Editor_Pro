import React, { useState, useEffect, useRef } from 'react';
import { Save, Cpu, BookmarkCheck, Variable } from 'lucide-react';
import {
  saveEditorAsAiCapability,
  AiCapabilityDefinition
} from '../../services/aiCapabilitiesStorage';
import { toastService } from '../../services/toastService';
import { ModalShell, ActionButton } from '../ui/Workbench';

export interface SaveCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPrompt?: string;
  defaultName?: string;
  onSaved?: (cap: AiCapabilityDefinition) => void;
}

const CATEGORY_OPTIONS: { key: AiCapabilityDefinition['category']; label: string }[] = [
  { key: 'generation', label: '⚡ SQL 生成与转换 (generation)' },
  { key: 'diagnosis', label: '🔍 错误诊断与修复 (diagnosis)' },
  { key: 'optimization', label: '🚀 性能重构与向量化 (optimization)' },
  { key: 'insight', label: '📊 数据与结果洞察 (insight)' },
  { key: 'quality', label: '🛡️ 数据质量审计 (quality)' },
  { key: 'schema', label: '📐 Schema 模型演进 (schema)' },
];

interface VariableGroup {
  title: string;
  description: string;
  variables: { token: string; label: string }[];
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    title: '基础变量',
    description: '用户输入与运行时上下文',
    variables: [
      { token: '{userPrompt}', label: '用户需求' },
      { token: '{rowCount}', label: '数据行数' },
    ],
  },
  {
    title: '数据上下文',
    description: 'Schema 与采样数据',
    variables: [
      { token: '{schemaContext}', label: '表结构' },
      { token: '{sampleData}', label: '样例数据' },
    ],
  },
  {
    title: 'SQL 与错误',
    description: '当前查询与执行反馈',
    variables: [
      { token: '{currentSql}', label: '当前 SQL' },
      { token: '{errorMessage}', label: '执行错误' },
    ],
  },
];

export const SaveCapabilityModal: React.FC<SaveCapabilityModalProps> = ({
  isOpen,
  onClose,
  defaultPrompt = '',
  defaultName = '',
  onSaved,
}) => {
  const [name, setName] = useState(defaultName || '');
  const [category, setCategory] = useState<AiCapabilityDefinition['category']>('generation');
  const [purpose, setPurpose] = useState('解决特定业务领域的 AI 提示词与分析场景');
  const [tagsInput, setTagsInput] = useState('编辑器沉淀, AI能力');
  const [promptTemplate, setPromptTemplate] = useState(defaultPrompt || '');
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName || '');
      setPromptTemplate(
        defaultPrompt
          ? defaultPrompt.includes('{schemaContext}')
            ? defaultPrompt
            : `请针对 DuckDB 处理以下需求：\n【需求】: ${defaultPrompt}\n\n【表结构上下文】:\n{schemaContext}`
          : '请为 DuckDB 生成 SQL：\n【需求描述】: {userPrompt}\n\n【表结构】:\n{schemaContext}'
      );
    }
  }, [isOpen, defaultPrompt, defaultName]);

  const handleInsertVariable = (varKey: string) => {
    const textarea = promptTextareaRef.current;
    if (!textarea) {
      setPromptTemplate(prev => `${prev} ${varKey}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = promptTemplate;
    const newText = currentText.substring(0, start) + varKey + currentText.substring(end);
    setPromptTemplate(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 50);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toastService.warning('请输入 AI 能力名称！');
      return;
    }
    if (!promptTemplate.trim()) {
      toastService.warning('Prompt 模板不能为空！');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newCap = saveEditorAsAiCapability(
      name.trim(),
      promptTemplate.trim(),
      category,
      purpose.trim(),
      tags
    );

    toastService.success(`成功沉淀并发布 AI 能力「${name.trim()}」！`);
    if (onSaved) onSaved(newCap);
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="沉淀为 AI 能力库"
      description="将当前提示词沉淀到可复用能力，跨会话一键调用"
      icon={Save}
      iconColor="text-monokai-accent"
      badge="Capability Hub"
      size="md"
      closeLabel="关闭保存能力弹窗"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 font-mono text-[11px] text-monokai-comment">
            <Variable className="h-3 w-3 text-monokai-accent" />
            支持 6 个内置变量 · 实时插入
          </span>
          <ActionButton variant="secondary" onClick={onClose}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={BookmarkCheck}
            onClick={handleSave}
          >
            保存到能力库
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4 text-xs font-sans">
        {/* 能力名称 */}
        <div>
          <label className="block text-monokai-comment font-semibold mb-1.5 tracking-tight">
            能力名称 <span className="text-monokai-pink">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 智能窗口聚合与分析"
            className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 font-sans transition-all"
          />
        </div>

        {/* 能力分类 & 标签 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-monokai-comment font-semibold mb-1.5 tracking-tight">能力分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AiCapabilityDefinition['category'])}
              className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 font-sans cursor-pointer transition-all"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-monokai-comment font-semibold mb-1.5 tracking-tight">标签 (逗号分隔)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="编辑器沉淀, 自定义"
              className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 font-mono transition-all"
            />
          </div>
        </div>

        {/* 适用用途 */}
        <div>
          <label className="block text-monokai-comment font-semibold mb-1.5 tracking-tight">适用用途 (Purpose)</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="简述该 AI 能力的场景与解决的问题..."
            className="w-full rounded-md border border-monokai-border bg-monokai-bg px-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 transition-all"
          />
        </div>

        {/* Prompt 模板 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-monokai-comment font-semibold tracking-tight">
              Prompt 提示词模板 <span className="text-monokai-pink">*</span>
            </label>
            <span className="text-[10px] font-mono text-monokai-comment/75">
              {promptTemplate.length} 字符
            </span>
          </div>

          {/* 三段式变量插入面板 */}
          <div className="mb-2 rounded-lg border border-monokai-border/70 bg-monokai-surface/40 p-2.5 space-y-2">
            {VARIABLE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Cpu className="h-3 w-3 text-monokai-accent/70" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-monokai-comment font-mono">
                    {group.title}
                  </span>
                  <span className="text-[9.5px] text-monokai-comment/65">· {group.description}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.variables.map((v) => (
                    <button
                      type="button"
                      key={v.token}
                      onClick={() => handleInsertVariable(v.token)}
                      className="group inline-flex items-center gap-1 rounded border border-monokai-border/80 bg-monokai-bg px-1.5 py-0.5 font-mono text-[10px] text-monokai-fg-muted hover:text-monokai-accent hover:border-monokai-accent/60 hover:bg-monokai-accent/10 transition-all"
                      title={`点击插入 ${v.token}`}
                    >
                      <span className="text-monokai-comment/65 group-hover:text-monokai-accent">+</span>
                      <span>{v.label}</span>
                      <span className="text-monokai-comment/60 group-hover:text-monokai-accent/80">[{v.token}]</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <textarea
            ref={promptTextareaRef}
            rows={6}
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            className="w-full rounded-md border border-monokai-border bg-monokai-bg p-3 text-xs font-mono text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 custom-scrollbar transition-all resize-y"
            spellCheck={false}
          />
        </div>
      </div>
    </ModalShell>
  );
};

export default SaveCapabilityModal;