import React, { useState, useMemo } from 'react';
import { Search, Play, Code, Eye, Check, Copy, Cpu, BookOpen, Layers, Sparkles, Filter, Terminal } from 'lucide-react';
import { QUICK_SQL_TEMPLATES, QUICK_TEMPLATE_CATEGORIES, DuckDbQuickTemplate, TemplateCategoryKey } from '../../data/duckdbTemplatesData';
import { TemplatePreviewModal } from '../AnalysisHub/TemplatePreviewModal';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';
import { toastService } from '../../services/toastService';

interface SqlTemplatesBoardProps {
  onInsertSql?: (sql: string) => void;
}

export const SqlTemplatesBoard: React.FC<SqlTemplatesBoardProps> = ({
  onInsertSql,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activePreviewTemplate, setActivePreviewTemplate] = useState<DuckDbQuickTemplate | null>(null);

  // Active SQL editor state to auto-detect current table and columns
  const activeTabId = useSqlEditorStore(s => s.activeTabId);
  const tabs = useSqlEditorStore(s => s.tabs);
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  const tables = useAppStore(s => s.tables);
  const currentTable = tables[0] || '';
  const activeColumns = activeTab?.result?.columns || [];

  const filteredTemplates = useMemo(() => {
    return QUICK_SQL_TEMPLATES.filter((tpl) => {
      const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
      const matchesSearch =
        tpl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.sqlExample.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tpl.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  const handleApplyTemplateToEditor = (sqlToInsert: string) => {
    if (onInsertSql) {
      onInsertSql(sqlToInsert);
    } else {
      useSqlEditorStore.getState().updateActiveTab({ code: sqlToInsert });
      useAppStore.getState().setActiveTab(Tab.SQL);
    }
    toastService.success('模板 SQL 已成功带入编辑器！');
  };

  return (
    <div className="flex flex-col gap-5 p-6 text-monokai-fg bg-monokai-bg min-h-full h-full overflow-y-auto custom-scrollbar font-sans">
      
      {/* Top Banner */}
      <div className="p-5 bg-monokai-surface border border-monokai-border rounded-lg shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-monokai-sidebar text-monokai-fg rounded-lg border border-monokai-border shrink-0">
            <Terminal size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-base font-bold text-monokai-fg tracking-tight flex items-center gap-2">
                DuckDB 常用 SQL 模板看板
              </h1>
              <span className="text-[11px] bg-white/[0.06] text-monokai-fg-muted px-2 py-0.5 rounded font-mono">
                11 大高频分类
              </span>
            </div>
            <p className="text-xs text-monokai-comment mt-1 leading-relaxed max-w-3xl">
              精炼提炼实战笔记：解决问题 ➔ SQL 示例 ➔ 可替换参数 ➔ 一键带入编辑器。自动感知当前数据库上下文。
            </p>
          </div>
        </div>

        {/* Database Context Auto-Detect Badge */}
        <div className="flex items-center gap-2.5 bg-monokai-sidebar border border-monokai-border px-3 py-2 rounded-md shrink-0 self-end lg:self-auto text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-monokai-comment uppercase font-bold flex items-center gap-1 font-mono">
              <Cpu size={11} className="text-monokai-accent" /> 当前数据库上下文:
            </span>
            <span className="font-mono text-monokai-fg text-[11px] font-medium mt-0.5">
              表: <span className={currentTable ? 'text-monokai-accent' : 'text-monokai-comment'}>{currentTable || '暂无可用数据表'}</span> ({activeColumns.length} 个字段)
            </span>
          </div>
        </div>
      </div>

      {/* Categories & Search Bar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 select-none">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1 bg-monokai-sidebar border border-monokai-border p-1 rounded-md">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-monokai-surface text-monokai-accent shadow-xs'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
            }`}
          >
            全部模板 ({QUICK_SQL_TEMPLATES.length})
          </button>
          {QUICK_TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-monokai-surface text-monokai-accent shadow-xs'
                  : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full xl:w-72 shrink-0">
          <Search size={14} className="absolute left-3 top-2.5 text-monokai-comment" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索模板名称、用途、参数或 SQL..."
            className="w-full bg-monokai-sidebar border border-monokai-border rounded-md pl-8 pr-3 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent/60 transition-colors font-medium placeholder:text-monokai-comment/60"
          />
        </div>
      </div>

      {/* Templates Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-monokai-surface border border-monokai-border hover:border-monokai-border-strong rounded-lg p-4 transition-all flex flex-col justify-between gap-3.5 group shadow-xs"
          >
            <div className="flex flex-col gap-2.5">
              
              {/* Template Title & Category */}
              <div className="flex items-start justify-between gap-2 border-b border-monokai-border/60 pb-2">
                <div>
                  <h3 className="text-xs font-semibold text-monokai-fg group-hover:text-monokai-accent transition-colors flex items-center gap-1.5">
                    {tpl.title}
                  </h3>
                  <span className="text-[10px] text-monokai-comment font-mono mt-0.5 block">
                    {tpl.categoryLabel} {tpl.notesRef ? `• 笔记参考 ${tpl.notesRef}` : ''}
                  </span>
                </div>
              </div>

              {/* 解决什么问题 (Purpose) */}
              <div className="bg-monokai-bg p-2.5 rounded-md border border-monokai-border-subtle">
                <div className="text-[10px] font-bold text-monokai-fg-muted uppercase tracking-wider mb-0.5 font-mono">
                  🎯 解决问题:
                </div>
                <div className="text-monokai-fg/90 text-xs leading-snug">
                  {tpl.purpose}
                </div>
              </div>

              {/* 可替换参数 (Key Parameters) */}
              <div className="text-[11px]">
                <span className="text-[10px] font-medium text-monokai-comment uppercase tracking-wider block mb-1 font-mono">
                  🔑 可替换参数:
                </span>
                <div className="flex flex-wrap gap-1">
                  {tpl.keyParameters.map((param, i) => (
                    <span key={i} className="text-[10px] bg-monokai-bg text-monokai-fg-muted border border-monokai-border-subtle px-1.5 py-0.5 rounded font-mono">
                      {param}
                    </span>
                  ))}
                </div>
              </div>

              {/* SQL 示例 (SQL Example) */}
              <div>
                <span className="text-[10px] font-medium text-monokai-comment uppercase tracking-wider block mb-1 font-mono">
                  💻 SQL 代码示例:
                </span>
                <pre className="p-2.5 bg-monokai-bg border border-monokai-border rounded-md text-[11px] font-mono text-monokai-fg/85 max-h-28 overflow-hidden line-clamp-4 whitespace-pre-wrap">
                  {tpl.sqlExample}
                </pre>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-monokai-border/60">
              <div className="flex flex-wrap gap-1">
                {tpl.tags.slice(0, 2).map(t => (
                  <span key={t} className="text-[9.5px] text-monokai-comment font-mono">#{t}</span>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActivePreviewTemplate(tpl)}
                  className="px-2.5 py-1.5 text-xs bg-monokai-bg hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg rounded-md transition-colors flex items-center gap-1 cursor-pointer border border-monokai-border"
                >
                  <Eye size={12} />
                  <span>预览参数</span>
                </button>

                <button
                  onClick={() => {
                    const finalSql = tpl.sqlExample
                      .replace(/\{table_name\}/g, currentTable)
                      .replace(/\{column_name\}/g, activeColumns[0] || 'score');
                    handleApplyTemplateToEditor(finalSql);
                  }}
                  className="px-3 py-1.5 text-xs bg-monokai-accent text-ide-bg font-semibold rounded-md hover:bg-monokai-accent-hover transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                  <Play size={11} fill="currentColor" />
                  <span>一键带入</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Template Preview & Parameter Binding Modal */}
      <TemplatePreviewModal
        template={activePreviewTemplate as any}
        currentTable={currentTable}
        activeColumns={activeColumns}
        onClose={() => setActivePreviewTemplate(null)}
        onApplyTemplate={handleApplyTemplateToEditor}
      />
    </div>
  );
};
