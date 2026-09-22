import React, { useState } from 'react';
import { Sparkles, Save } from 'lucide-react';
import { saveEditorSqlAsTemplate } from '../../services/sqlTemplatesStorage';
import { QUICK_TEMPLATE_CATEGORIES, TemplateCategoryKey } from '../../data/duckdbTemplatesData';
import { toastService } from '../../services/toastService';
import { ActionButton, FormInput, FormSelect, FormTextarea, ModalShell } from '../ui/Workbench';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSql: string;
  defaultTitle?: string;
  onSaved?: () => void;
}

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  onClose,
  defaultSql,
  defaultTitle = '',
  onSaved,
}) => {
  const [title, setTitle] = useState(defaultTitle || '常用分析模板');
  const [category, setCategory] = useState<TemplateCategoryKey>('basic_query');
  const [purpose, setPurpose] = useState('解决特定业务查询与分析场景');
  const [tagsInput, setTagsInput] = useState('编辑器沉淀, 常用');
  const [sqlContent, setSqlContent] = useState(defaultSql || '');

  React.useEffect(() => {
    setSqlContent(defaultSql || '');
  }, [defaultSql]);

  const recommendedCategory = React.useMemo<TemplateCategoryKey | null>(() => {
    const upper = sqlContent.toUpperCase();
    if (upper.includes('JOIN')) return 'join';
    if (upper.includes('GROUP BY') || upper.includes('COUNT(') || upper.includes('SUM(')) return 'aggregation';
    if (upper.includes('OVER(') || upper.includes('WINDOW')) return 'window';
    if (upper.includes('WHERE') || upper.includes('LIKE')) return 'filtering';
    if (upper.includes('DATE_TRUNC') || upper.includes('STRFTIME') || upper.includes('NOW()')) return 'string_date';
    if (upper.includes('COPY ') || upper.includes('READ_PARQUET')) return 'file_io';
    return null;
  }, [sqlContent]);

  const recommendedTags = React.useMemo<string[]>(() => {
    const upper = sqlContent.toUpperCase();
    const tags: string[] = [];
    if (upper.includes('JOIN')) tags.push('多表关联');
    if (upper.includes('GROUP BY')) tags.push('分组聚合');
    if (upper.includes('OVER(')) tags.push('窗口开窗');
    if (upper.includes('WITH ')) tags.push('CTE表达式');
    if (upper.includes('DATE') || upper.includes('TIME')) tags.push('时间序列');
    return tags;
  }, [sqlContent]);

  const handleSave = () => {
    if (!title.trim()) {
      toastService.warning('请输入模板标题！');
      return;
    }
    if (!sqlContent.trim()) {
      toastService.warning('SQL 代码不能为空！');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    saveEditorSqlAsTemplate(title.trim(), sqlContent, category, purpose.trim(), tags);
    toastService.success(`已成功沉淀为 Analysis Hub 模板「${title.trim()}」！`);
    onSaved?.();
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="沉淀为 Analysis Hub 模板"
      description="将当前 SQL 沉淀为可复用的团队分析模板与参数化查询"
      icon={Sparkles}
      iconColor="text-monokai-amethyst"
      size="md"
      footer={
        <>
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            取消
          </ActionButton>
          <ActionButton variant="amethyst" size="sm" icon={Save} onClick={handleSave}>
            保存并沉淀
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="mb-1.5 block font-medium text-monokai-comment">模板标题 (*)</label>
          <FormInput
            fontVariant="mono"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例如: 常用活跃用户多维度聚合"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-medium text-monokai-comment">模板分类</label>
              {recommendedCategory && recommendedCategory !== category && (
                <button
                  type="button"
                  onClick={() => setCategory(recommendedCategory)}
                  className="inline-flex cursor-pointer items-center gap-0.5 text-2xs font-bold text-monokai-amethyst hover:underline"
                >
                  <Sparkles size={10} aria-hidden="true" />
                  推荐: {QUICK_TEMPLATE_CATEGORIES.find(c => c.key === recommendedCategory)?.label}
                </button>
              )}
            </div>
            <FormSelect
              className="font-mono"
              value={category}
              onChange={e => setCategory(e.target.value as TemplateCategoryKey)}
            >
              {QUICK_TEMPLATE_CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <label className="mb-1.5 block font-medium text-monokai-comment">标签 (逗号分隔)</label>
            <FormInput
              fontVariant="mono"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="编辑器沉淀, 常用"
            />
          </div>
        </div>

        {recommendedTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-monokai-border/80 bg-monokai-bg/80 p-2.5">
            <span className="font-mono text-2xs font-semibold text-monokai-comment">AI 智能推荐标签:</span>
            {recommendedTags.map(tag => {
              const isSelected = tagsInput.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (!isSelected) setTagsInput(prev => (prev ? `${prev}, ${tag}` : tag));
                  }}
                  disabled={isSelected}
                  className={`cursor-pointer rounded-md border px-2 py-0.5 text-2xs transition-all ${
                    isSelected
                      ? 'cursor-default border-monokai-accent/30 bg-monokai-accent/20 text-monokai-accent opacity-60'
                      : 'border-monokai-amethyst/30 bg-monokai-amethyst/15 text-monokai-amethyst hover:bg-monokai-amethyst/25 active:scale-95'
                  }`}
                >
                  + {tag}
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="mb-1.5 block font-medium text-monokai-comment">解决什么问题 (用途描述)</label>
          <FormInput
            fontVariant="mono"
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="简述该 SQL 模板的应用场景与解决的问题..."
          />
        </div>

        <div>
          <label className="mb-1.5 block font-medium text-monokai-comment">SQL 样例代码 (包含占位符)</label>
          <FormTextarea
            rows={5}
            fontVariant="mono"
            value={sqlContent}
            onChange={e => setSqlContent(e.target.value)}
          />
        </div>
      </div>
    </ModalShell>
  );
};
