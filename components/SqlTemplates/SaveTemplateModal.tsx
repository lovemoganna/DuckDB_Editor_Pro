import React, { useState } from 'react';
import { Sparkles, Save, X } from 'lucide-react';
import { saveEditorSqlAsTemplate } from '../../services/sqlTemplatesStorage';
import { QUICK_TEMPLATE_CATEGORIES, TemplateCategoryKey } from '../../data/duckdbTemplatesData';
import { toastService } from '../../services/toastService';

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

  // Smart category & tag recommendation based on SQL keywords
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

  if (!isOpen) return null;

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
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-monokai-fg flex flex-col font-sans">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-monokai-border bg-monokai-bg/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-monokai-amethyst/15 border border-monokai-amethyst/30 flex items-center justify-center text-monokai-amethyst">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-monokai-fg">沉淀为 Analysis Hub 模板</h3>
              <p className="text-[10px] text-monokai-comment">将当前 SQL 沉淀为可复用的团队分析模板与参数化查询</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-monokai-surface flex items-center justify-center text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar select-text text-xs">
          <div>
            <label className="block text-monokai-comment mb-1.5 font-medium">模板标题 (*)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如: 常用活跃用户多维度聚合"
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-amethyst/70 focus:ring-1 focus:ring-monokai-amethyst/20 font-mono transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-monokai-comment font-medium">模板分类</label>
                {recommendedCategory && recommendedCategory !== category && (
                  <button
                    onClick={() => setCategory(recommendedCategory)}
                    className="text-[10px] text-monokai-amethyst hover:underline cursor-pointer font-bold flex items-center gap-0.5"
                  >
                    <Sparkles size={10} />
                    推荐: {QUICK_TEMPLATE_CATEGORIES.find(c => c.key === recommendedCategory)?.label}
                  </button>
                )}
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategoryKey)}
                className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg outline-none focus:border-monokai-amethyst cursor-pointer font-mono"
              >
                {QUICK_TEMPLATE_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-monokai-comment mb-1.5 font-medium">标签 (逗号分隔)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="编辑器沉淀, 常用"
                className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-amethyst/70 focus:ring-1 focus:ring-monokai-amethyst/20 font-mono transition-all"
              />
            </div>
          </div>

          {/* Recommended Tag Chips */}
          {recommendedTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap bg-monokai-bg/80 p-2.5 rounded-lg border border-monokai-border/80">
              <span className="text-[10px] text-monokai-comment font-mono font-semibold">AI 智能推荐标签:</span>
              {recommendedTags.map(tag => {
                const isSelected = tagsInput.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      if (!isSelected) {
                        setTagsInput(prev => prev ? `${prev}, ${tag}` : tag);
                      }
                    }}
                    disabled={isSelected}
                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-monokai-green/20 text-monokai-green border-monokai-green/30 opacity-60 cursor-default'
                        : 'bg-monokai-amethyst/15 text-monokai-amethyst border-monokai-amethyst/30 hover:bg-monokai-amethyst/25 active:scale-95'
                    }`}
                  >
                    + {tag}
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-monokai-comment mb-1.5 font-medium">解决什么问题 (用途描述)</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="简述该 SQL 模板的应用场景与解决的问题..."
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-2 text-xs text-monokai-fg placeholder-monokai-comment/50 outline-none focus:border-monokai-amethyst/70 focus:ring-1 focus:ring-monokai-amethyst/20 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-monokai-comment mb-1.5 font-medium">SQL 样例代码 (包含占位符)</label>
            <textarea
              rows={5}
              value={sqlContent}
              onChange={(e) => setSqlContent(e.target.value)}
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg p-3 text-xs font-mono text-monokai-fg/90 outline-none focus:border-monokai-amethyst/70 focus:ring-1 focus:ring-monokai-amethyst/20 custom-scrollbar leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-monokai-border bg-monokai-bg/90 flex justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-monokai-surface text-monokai-comment hover:text-monokai-fg rounded-lg text-xs font-medium cursor-pointer transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4.5 py-1.5 bg-monokai-amethyst text-monokai-bg font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <Save size={13} />
            <span>保存并沉淀</span>
          </button>
        </div>
      </div>
    </div>
  );
};
