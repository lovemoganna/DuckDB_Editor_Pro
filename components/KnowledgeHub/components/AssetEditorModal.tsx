import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Code2, 
  Target, 
  BookMarked,
  Tag as TagIcon,
} from 'lucide-react';
import { format } from 'sql-formatter';
import { KnowledgeAsset, AssetType, CodeAsset, MetricAsset, NoteAsset, CodeCategory, NoteTopic } from '../types';
import { ModalShell } from '../../ui/Workbench';

interface AssetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToEdit?: KnowledgeAsset | null;
  defaultType?: AssetType;
  onSave: (asset: KnowledgeAsset) => void;
}

export const AssetEditorModal: React.FC<AssetEditorModalProps> = ({
  isOpen,
  onClose,
  assetToEdit,
  defaultType = 'code',
  onSave,
}) => {
  const [assetType, setAssetType] = useState<AssetType>(defaultType);

  // 
  const [id, setId] = useState('');
  const [tagsStr, setTagsStr] = useState('');

  // 
  const [codeTitle, setCodeTitle] = useState('');
  const [codeCategory, setCodeCategory] = useState<CodeCategory>('snippet');
  const [codeDesc, setCodeDesc] = useState('');
  const [codeSql, setCodeSql] = useState('');

  // 
  const [metricName, setMetricName] = useState('');
  const [metricMeaning, setMetricMeaning] = useState('');
  const [metricFormula, setMetricFormula] = useState('');
  const [metricSql, setMetricSql] = useState('');
  const [metricTablesStr, setMetricTablesStr] = useState('');
  const [metricDimsStr, setMetricDimsStr] = useState('');
  const [metricOwner, setMetricOwner] = useState('');

  // 
  const [noteTitle, setNoteTitle] = useState('');
  const [noteTopic, setNoteTopic] = useState<NoteTopic>('pitfall');
  const [noteSummary, setNoteSummary] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteRefsStr, setNoteRefsStr] = useState('');

  useEffect(() => {
    if (assetToEdit) {
      setAssetType(assetToEdit.type);
      setId(assetToEdit.id);
      setTagsStr((assetToEdit.tags || []).join(', '));

      if (assetToEdit.type === 'code') {
        setCodeTitle(assetToEdit.title);
        setCodeCategory(assetToEdit.category);
        setCodeDesc(assetToEdit.description);
        setCodeSql(assetToEdit.sql);
      } else if (assetToEdit.type === 'metric') {
        setMetricName(assetToEdit.name);
        setMetricMeaning(assetToEdit.businessMeaning);
        setMetricFormula(assetToEdit.calculationFormula);
        setMetricSql(assetToEdit.sqlExpression);
        setMetricTablesStr((assetToEdit.sourceTables || []).join(', '));
        setMetricDimsStr((assetToEdit.dimensions || []).join(', '));
        setMetricOwner(assetToEdit.owner || '');
      } else if (assetToEdit.type === 'note') {
        setNoteTitle(assetToEdit.title);
        setNoteTopic(assetToEdit.topic);
        setNoteSummary(assetToEdit.summary);
        setNoteContent(assetToEdit.content);
        setNoteRefsStr((assetToEdit.references || []).join(', '));
      }
    } else {
      setAssetType(defaultType);
      setId(`asset-${Date.now()}`);
      setTagsStr('');
      setCodeTitle('');
      setCodeCategory('snippet');
      setCodeDesc('');
      setCodeSql('');
      setMetricName('');
      setMetricMeaning('');
      setMetricFormula('');
      setMetricSql('');
      setMetricTablesStr('');
      setMetricDimsStr('');
      setMetricOwner('');
      setNoteTitle('');
      setNoteTopic('pitfall');
      setNoteSummary('');
      setNoteContent('');
      setNoteRefsStr('');
    }
  }, [assetToEdit, defaultType, isOpen]);

  if (!isOpen) return null;

  const parseArray = (str: string) => {
    return str
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = parseArray(tagsStr);
    const now = new Date().toISOString();

    if (assetType === 'code') {
      if (!codeTitle.trim() || !codeSql.trim()) return;
      const asset: CodeAsset = {
        id: id || `code-${Date.now()}`,
        type: 'code',
        title: codeTitle.trim(),
        category: codeCategory,
        description: codeDesc.trim(),
        sql: codeSql.trim(),
        tags,
        isFavorite: assetToEdit?.isFavorite || false,
        createdAt: assetToEdit?.createdAt || now,
        updatedAt: now,
      };
      onSave(asset);
    } else if (assetType === 'metric') {
      if (!metricName.trim() || !metricFormula.trim()) return;
      const asset: MetricAsset = {
        id: id || `metric-${Date.now()}`,
        type: 'metric',
        name: metricName.trim(),
        businessMeaning: metricMeaning.trim(),
        calculationFormula: metricFormula.trim(),
        sqlExpression: metricSql.trim(),
        sourceTables: parseArray(metricTablesStr),
        dimensions: parseArray(metricDimsStr),
        owner: metricOwner.trim(),
        tags,
        isFavorite: assetToEdit?.isFavorite || false,
        createdAt: assetToEdit?.createdAt || now,
        updatedAt: now,
      };
      onSave(asset);
    } else if (assetType === 'note') {
      if (!noteTitle.trim() || !noteContent.trim()) return;
      const asset: NoteAsset = {
        id: id || `note-${Date.now()}`,
        type: 'note',
        title: noteTitle.trim(),
        topic: noteTopic,
        summary: noteSummary.trim(),
        content: noteContent.trim(),
        references: parseArray(noteRefsStr),
        tags,
        isFavorite: assetToEdit?.isFavorite || false,
        createdAt: assetToEdit?.createdAt || now,
        updatedAt: now,
      };
      onSave(asset);
    }

    onClose();
  };

  const TypeIcon = assetType === 'metric' ? Target : assetType === 'note' ? BookMarked : Code2;

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title={assetToEdit ? '编辑知识资产' : '创建新知识资产'}
      description="沉淀到本地统一知识资产库 (IndexedDB)，随时复用"
      size="lg"
      icon={TypeIcon}
      iconColor="text-monokai-accent"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* 资产类型选择 (仅新建时展示) */}
          {!assetToEdit && (
            <div className="flex items-center gap-2 p-1 bg-monokai-bg rounded-xl border border-monokai-border">
              <button
                type="button"
                onClick={() => setAssetType('code')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  assetType === 'code'
                    ? 'bg-monokai-border text-monokai-accent shadow'
                    : 'text-monokai-comment hover:text-monokai-fg-muted'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>代码资产</span>
              </button>
              <button
                type="button"
                onClick={() => setAssetType('metric')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  assetType === 'metric'
                    ? 'bg-monokai-border text-monokai-cyan shadow'
                    : 'text-monokai-comment hover:text-monokai-fg-muted'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>指标资产</span>
              </button>
              <button
                type="button"
                onClick={() => setAssetType('note')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  assetType === 'note'
                    ? 'bg-monokai-border text-monokai-yellow shadow'
                    : 'text-monokai-comment hover:text-monokai-fg-muted'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span>知识笔记</span>
              </button>
            </div>
          )}

          {/* 1. 代码 / SQL 资产 */}
          {assetType === 'code' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                    标题 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={codeTitle}
                    onChange={(e) => setCodeTitle(e.target.value)}
                    placeholder="例如：Parquet 高效过滤与分页查询"
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">分类</label>
                  <select
                    value={codeCategory}
                    onChange={(e) => setCodeCategory(e.target.value as CodeCategory)}
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  >
                    <option value="snippet">代码片段</option>
                    <option value="template">SQL 模板</option>
                    <option value="script">多步脚本</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-monokai-fg-muted font-medium mb-1">简要说明</label>
                <input
                  type="text"
                  value={codeDesc}
                  onChange={(e) => setCodeDesc(e.target.value)}
                  placeholder="例如：用于快速抽样 Parquet 元数据与分布的 SQL 模板..."
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-monokai-fg-muted font-medium">
                    SQL 正文 / 模板定义 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-monokai-comment font-mono">
                      支持参数化占位符 {'{{param_name}}'}
                    </span>
                    {codeSql.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            setCodeSql(format(codeSql, { language: 'duckdb', tabWidth: 2, keywordCase: 'upper' }));
                          } catch {}
                        }}
                        className="flex items-center gap-1 text-[10.5px] text-monokai-accent hover:text-monokai-accent-hover px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>格式化 SQL</span>
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  required
                  rows={8}
                  value={codeSql}
                  onChange={(e) => setCodeSql(e.target.value)}
                  placeholder={`SELECT * FROM {{table_name}} WHERE event_date >= '{{start_date}}';`}
                  className="w-full bg-monokai-bg border border-monokai-border rounded-md p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none leading-relaxed"
                />
              </div>
            </>
          )}

          {/* 2. 指标资产 */}
          {assetType === 'metric' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                    指标名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={metricName}
                    onChange={(e) => setMetricName(e.target.value)}
                    placeholder="例如：GMV (含退款口径)"
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">负责人 / Owner</label>
                  <input
                    type="text"
                    value={metricOwner}
                    onChange={(e) => setMetricOwner(e.target.value)}
                    placeholder="输入内容"
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                  计算公式 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={metricFormula}
                  onChange={(e) => setMetricFormula(e.target.value)}
                  placeholder="例如：SUM(pay_amount) - SUM(refund_amount)"
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-monokai-fg-muted font-medium mb-1">业务含义</label>
                <textarea
                  rows={2}
                  value={metricMeaning}
                  onChange={(e) => setMetricMeaning(e.target.value)}
                  placeholder="说明该指标的业务口径、适用范围与注意事项..."
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg p-2 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                    ()
                  </label>
                  <input
                    type="text"
                    value={metricTablesStr}
                    onChange={(e) => setMetricTablesStr(e.target.value)}
                    placeholder="fact_orders, dim_product"
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                    常用分析维度 (逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={metricDimsStr}
                    onChange={(e) => setMetricDimsStr(e.target.value)}
                    placeholder="日期, 渠道, 品类"
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-monokai-fg-muted font-medium">
                    可执行参考 SQL
                  </label>
                  {metricSql.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          setMetricSql(format(metricSql, { language: 'duckdb', tabWidth: 2, keywordCase: 'upper' }));
                        } catch {}
                      }}
                      className="flex items-center gap-1 text-[10.5px] text-monokai-accent hover:text-monokai-accent-hover px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>格式化 SQL</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={metricSql}
                  onChange={(e) => setMetricSql(e.target.value)}
                  placeholder="SELECT date_trunc('day', pay_time), sum(amount) FROM fact_orders GROUP BY 1;"
                  className="w-full bg-monokai-bg border border-monokai-border rounded-md p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none leading-relaxed"
                />
              </div>
            </>
          )}

          {/* 3. 知识笔记 */}
          {assetType === 'note' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                    笔记标题 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="例如：DuckDB WASM 时区解析陷阱与规避方案"
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-monokai-fg-muted font-medium mb-1">专题分类</label>
                  <select
                    value={noteTopic}
                    onChange={(e) => setNoteTopic(e.target.value as NoteTopic)}
                    className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                  >
                    <option value="pitfall">踩坑记录</option>
                    <option value="optimization">优化技巧</option>
                    <option value="best_practice">最佳实践</option>
                    <option value="memo">备忘笔记</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-monokai-fg-muted font-medium mb-1">核心结论摘要</label>
                <input
                  type="text"
                  value={noteSummary}
                  onChange={(e) => setNoteSummary(e.target.value)}
                  placeholder="一句话概括本笔记的核心结论..."
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                  正文内容 (Markdown 格式) <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="## 问题背景\n\n## 解决步骤\n\n```sql\nSELECT ...\n```"
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg p-3 text-xs text-monokai-fg-muted font-mono focus:outline-none focus:border-monokai-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-monokai-fg-muted font-medium mb-1">
                  延伸阅读与参考链接 (逗号分隔)
                </label>
                <input
                  type="text"
                  value={noteRefsStr}
                  onChange={(e) => setNoteRefsStr(e.target.value)}
                  placeholder="https://duckdb.org/docs/..."
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
                />
              </div>
            </>
          )}

          {/* 标签 */}
          <div>
            <label className="block text-xs text-monokai-fg-muted font-medium mb-1 flex items-center gap-1">
              <TagIcon className="w-3 h-3 text-monokai-comment" />
              <span>标签 (逗号分隔)</span>
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="DuckDB, 性能, 最佳实践"
              className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-3 py-1.5 text-xs text-monokai-fg-muted focus:outline-none focus:border-monokai-accent"
            />
          </div>

          {/* 操作按钮 */}
          <div className="pt-2 border-t border-monokai-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-elevated transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存知识资产</span>
            </button>
          </div>
        </form>
    </ModalShell>
  );
};
