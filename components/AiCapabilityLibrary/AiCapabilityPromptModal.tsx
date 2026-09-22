import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Database, ChevronDown, FileText } from 'lucide-react';
import { AiCapabilityDefinition } from '../../services/aiCapabilitiesStorage';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { aiService } from '../../services/aiService';
import { ModalShell, ActionButton } from '../ui/Workbench';

export interface AiCapabilityPromptModalProps {
  modalData: {
    isOpen: boolean;
    capability: AiCapabilityDefinition;
    substitutedPrompt: string;
    schemaContext: string;
  } | null;
  onClose: () => void;
}

export const AiCapabilityPromptModal: React.FC<AiCapabilityPromptModalProps> = ({
  modalData,
  onClose,
}) => {
  const [userPromptInput, setUserPromptInput] = useState('');
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (modalData?.isOpen) {
      setUserPromptInput('');
      setShowSchemaPreview(false);
      setIsSubmitting(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [modalData?.isOpen]);

  if (!modalData || !modalData.isOpen) return null;

  const { capability, substitutedPrompt, schemaContext } = modalData;
  const state = useSqlEditorStore.getState();
  const activeTab = state.getActiveTab();
  const currentSql = activeTab?.code || '';

  const handleSubmit = async () => {
    if (!userPromptInput.trim()) {
      state.showToast('请输入具体的需求描述！', 'warning');
      return;
    }

    setIsSubmitting(true);
    state.setIsAiLoading(true);

    try {
      const finalPrompt = substitutedPrompt.replace(/\{userPrompt\}/g, userPromptInput.trim());
      const response = await aiService.generateSql(finalPrompt, schemaContext);

      if (response.startsWith('-- Error generating SQL:')) {
        const errorDetail = response.replace('-- Error generating SQL:', '').trim();
        state.showToast(`AI 执行失败: ${errorDetail}`, 'warning');
        if (errorDetail.includes('API Key not configured')) {
          useAppStore.getState().setShowSettingsModal(true);
        }
        return;
      }

      onClose();

      if (capability.category === 'insight') {
        state.setAiResultInsights({
          isOpen: true,
          result: activeTab?.result || null,
          insightMarkdown: response,
          isLoading: false,
        });
      } else {
        state.setAiProposal({
          isOpen: true,
          title: `🤖 AI 能力执行: ${capability.name}`,
          explanation: `【关联场景】: ${capability.purpose || capability.description}\n【补充需求】: ${userPromptInput.trim()}`,
          originalSql: currentSql,
          proposedSql: response.replace(/```sql|```/g, '').trim(),
        });
      }
    } catch (e: any) {
      console.error(e);
      state.showToast(`AI 执行失败: ${e.message || e}`, 'warning');
    } finally {
      setIsSubmitting(false);
      state.setIsAiLoading(false);
    }
  };

  return (
    <ModalShell
      open={modalData.isOpen}
      onClose={onClose}
      title={`调用 AI 能力「${capability.name}」`}
      description={capability.purpose || capability.description}
      icon={Sparkles}
      iconColor="text-monokai-amethyst"
      badge={capability.category}
      size="md"
      closeLabel="关闭 AI 能力弹窗"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 font-mono text-[11px] text-monokai-comment">
            <Sparkles className="h-3 w-3 text-monokai-amethyst animate-pulse" />
            {isSubmitting ? 'AI 模型推理中…' : 'Prompt 模板已就绪'}
          </span>
          <ActionButton variant="secondary" onClick={onClose}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={Send}
            onClick={handleSubmit}
            disabled={isSubmitting || !userPromptInput.trim()}
            loading={isSubmitting}
          >
            {isSubmitting ? 'AI 分析执行中...' : '提交并由 AI 分析执行'}
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4 text-xs font-sans">
        {/* 用户补充输入 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-monokai-comment font-semibold tracking-tight">
              请补充具体的业务分析需求 <span className="text-monokai-pink">*</span>
            </label>
            <span className="text-[10px] font-mono text-monokai-yellow tracking-tight">
              支持多行输入 · Ctrl+Enter 提交
            </span>
          </div>
          <textarea
            ref={textareaRef}
            rows={4}
            value={userPromptInput}
            onChange={(e) => setUserPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!isSubmitting && userPromptInput.trim()) {
                  handleSubmit();
                }
              }
            }}
            placeholder="例如：按月份统计各类产品的销售额与同比增幅，过滤出金额大于 10000 的记录..."
            className="w-full rounded-md border border-monokai-border bg-monokai-bg p-3 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 custom-scrollbar resize-none font-sans transition-all"
            spellCheck={false}
          />
          <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-mono text-monokai-comment">
            <span>
              <span className="text-monokai-comment/65">字符数</span>{' '}
              <span className="text-monokai-fg-muted">{userPromptInput.length}</span>
            </span>
            <span className="text-monokai-comment/65">
              将自动注入 <code className="text-monokai-cyan">{'{userPrompt}'}</code> 占位符
            </span>
          </div>
        </div>

        {/* Schema 上下文折叠面板 */}
        <div className="rounded-lg border border-monokai-border bg-monokai-bg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSchemaPreview(!showSchemaPreview)}
            className="flex w-full items-center justify-between bg-monokai-surface/70 hover:bg-monokai-surface px-3 py-2.5 text-[11px] font-medium text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer border-b border-transparent hover:border-monokai-border"
          >
            <span className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-monokai-accent shrink-0" />
              <span className="text-monokai-fg-muted">自动关联的数据库上下文 (Schema Context)</span>
              <span className="text-[10px] font-mono text-monokai-comment/70">
                {schemaContext ? `${schemaContext.length} chars` : '空'}
              </span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showSchemaPreview ? 'rotate-180 text-monokai-accent' : 'text-monokai-comment'
              }`}
            />
          </button>
          {showSchemaPreview && (
            <div className="border-t border-monokai-border p-3 bg-monokai-bg">
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono text-monokai-comment">
                <FileText className="h-3 w-3 text-monokai-comment" />
                <span>Schema Context 预览</span>
                <span className="text-monokai-comment/65">· 将随 Prompt 发送给 AI</span>
              </div>
              <pre className="max-h-44 overflow-y-auto custom-scrollbar rounded border border-monokai-border bg-monokai-surface p-2.5 font-mono text-[11px] text-monokai-fg/85 whitespace-pre-wrap leading-relaxed">
                {schemaContext || '-- 暂无检测到的表结构上下文 --'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default AiCapabilityPromptModal;