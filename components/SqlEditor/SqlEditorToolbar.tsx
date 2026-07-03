import React from 'react';
import {
  Play, Code, ChevronDown, Sparkles, Save, Type, Trash2, Minimize2, Maximize2,
  Eye, EyeOff, ChevronLeft, ChevronRight, Loader2, Wand2, Database, FileText
} from 'lucide-react';
import { SqlTab } from '../../types';
import { SNIPPET_GROUPS, SNIPPET_CATEGORY_META } from '../../data/sqlEditorData';

export interface SqlEditorToolbarProps {
  activeTab: SqlTab;
  isZenMode: boolean;
  showSnippetsMenu: boolean;
  expandedSnippetCategory: string | null;
  hoveredSnippet: { label: string; sql: string } | null;
  showMaterializeMenu: boolean;
  showLivePreview: boolean;
  isAiLoading: boolean;
  aiPrompt: string;
  selectedSqlType: string;
  lastClearedContent: { sql: string; aiInput: string } | null;
  onUndoClear: () => void;
  onExecute: () => void;
  onToggleSnippets: () => void;
  onSnippetCategoryToggle: (category: string | null) => void;
  onSnippetHover: (snippet: { label: string; sql: string } | null) => void;
  onSnippetInsert: (sql: string) => void;
  onSnippetsMenuToggle: () => void;
  onShowSkillAssistant: () => void;
  onToggleMaterializeMenu: () => void;
  onOpenMaterializeModal: (type: 'TABLE' | 'VIEW') => void;
  onFormatSql: () => void;
  onSaveModal: () => void;
  onClear: () => void;
  onToggleZen: () => void;
  onToggleLivePreview: () => void;
  onAiPromptChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAiPromptClear: () => void;
  onAiGenerate: () => void;
  onSqlTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAIFill: () => void;
  onAiExplain: () => void;
}

export const SqlEditorToolbar: React.FC<SqlEditorToolbarProps> = ({
  activeTab,
  isZenMode,
  showSnippetsMenu,
  expandedSnippetCategory,
  hoveredSnippet,
  showMaterializeMenu,
  showLivePreview,
  isAiLoading,
  aiPrompt,
  selectedSqlType,
  lastClearedContent,
  onUndoClear,
  onExecute,
  onToggleSnippets,
  onSnippetCategoryToggle,
  onSnippetHover,
  onSnippetInsert,
  onSnippetsMenuToggle,
  onShowSkillAssistant,
  onToggleMaterializeMenu,
  onOpenMaterializeModal,
  onFormatSql,
  onSaveModal,
  onClear,
  onToggleZen,
  onToggleLivePreview,
  onAiPromptChange,
  onAiPromptClear,
  onAiGenerate,
  onSqlTypeChange,
  onAIFill,
  onAiExplain,
}) => {
  const tableMatch = activeTab.code.match(/(?:FROM|INTO|UPDATE|TABLE)\s+"?([a-zA-Z0-9_.]+)"?/i);
  const detectedTable = tableMatch?.[1];

  return (
    <div className="flex items-center justify-between p-1.5 bg-monokai-bg border-b border-monokai-accent z-40 gap-2 flex-wrap md:flex-nowrap w-full overflow-x-auto custom-scrollbar select-none shadow-md">
      {/* Left side: Execution, Modes, AI context */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        {/* Undo clear */}
        {lastClearedContent && (
          <button
            onClick={onUndoClear}
            className="flex items-center justify-center p-1.5 bg-monokai-blue/10 border border-monokai-blue/40 hover:bg-monokai-blue/20 text-monokai-blue rounded-sm transition-all"
            title="撤销上一次清除"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Run */}
        <button
          onClick={onExecute}
          disabled={activeTab.loading}
          className={`px-3 py-1 bg-monokai-green text-monokai-bg font-bold rounded-sm text-xs hover:opacity-90 hover:shadow-[0_0_8px_rgba(166,226,46,0.3)] transition-transform active:scale-95 flex items-center gap-1.5 disabled:opacity-50 shrink-0`}
        >
          <Play size={11} className={activeTab.loading ? 'animate-pulse' : ''} />
          运行
        </button>

        {/* Mode */}
        <select
          value={selectedSqlType}
          onChange={onSqlTypeChange}
          className="bg-monokai-surface border border-monokai-accent rounded-sm px-1 py-1 text-[11px] text-monokai-fg outline-none focus:border-monokai-purple transition-all cursor-pointer h-7 shrink-0"
        >
          <option value="select">SELECT</option>
          <option value="join">JOIN</option>
          <option value="aggregate">聚合</option>
          <option value="transform">转换</option>
          <option value="performance">执行</option>
          <option value="utilities">工具</option>
        </select>

        {/* AI intelligent fill */}
        <button
          onClick={onAIFill}
          className="flex items-center gap-1 px-2 py-1 bg-monokai-green/10 border border-monokai-green/40 hover:bg-monokai-green/20 text-monokai-green text-[11px] font-medium rounded-sm transition-all h-7 shrink-0"
          title={detectedTable ? `基于表 ${detectedTable} 的上下文智能填充 SQL` : '基于当前表/列上下文智能填充 SQL'}
        >
          <Sparkles className="w-3 h-3" />
          AI
          {detectedTable && (
            <span className="text-[9px] bg-monokai-green/20 text-monokai-green/80 px-1 py-0.5 rounded-sm font-mono truncate max-w-[80px]">
              {detectedTable}
            </span>
          )}
        </button>
      </div>

      {/* Middle side: Natural language generation */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-lg shrink-0">
        <div className="flex items-center gap-1 bg-monokai-surface px-2 py-1 rounded-sm border border-monokai-accent focus-within:border-monokai-purple/60 transition-all flex-1 h-7">
          <Wand2 className="w-3 h-3 text-monokai-purple/70 shrink-0" />
          <input
            type="text"
            value={aiPrompt}
            onChange={onAiPromptChange}
            onKeyDown={(e) => e.key === 'Enter' && !isAiLoading && onAiGenerate()}
            placeholder="描述需求，AI 生成 SQL..."
            className="bg-transparent border-none focus:ring-0 text-monokai-blue placeholder-monokai-comment/40 outline-none font-mono text-[11px] flex-1 py-0"
          />
          {aiPrompt && (
            <button
              onClick={onAiPromptClear}
              className="text-monokai-comment hover:text-monokai-pink transition-colors shrink-0 p-0.5"
              title="清除输入"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onAiGenerate}
            disabled={isAiLoading || !aiPrompt.trim()}
            className="text-monokai-purple hover:text-monokai-fg disabled:opacity-40 transition-all shrink-0 p-0.5"
          >
            {isAiLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Explain */}
        <button
          onClick={onAiExplain}
          disabled={!activeTab.code.trim()}
          className="p-1.5 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/10 disabled:opacity-40 rounded-sm transition-all h-7 shrink-0 flex items-center justify-center"
          title="AI 解释当前 SQL"
        >
          <Sparkles size={11} />
        </button>

        {/* Skills */}
        <button
          onClick={onShowSkillAssistant}
          className="px-2 py-1 bg-monokai-purple/10 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/20 text-[11px] font-medium rounded-sm flex items-center gap-1 transition-all h-7 shrink-0"
          title="AI 技能"
        >
          <Sparkles size={11} />
          技能
        </button>
      </div>

      {/* Right side: Snippets, Materialization, and Editor Options */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
        {/* Snippets */}
        <div className="relative">
          <button
            onClick={onToggleSnippets}
            className="px-2 py-1 bg-monokai-yellow/10 border border-monokai-yellow/30 text-monokai-yellow hover:bg-monokai-yellow/20 text-[11px] font-bold rounded-sm flex items-center gap-1 transition-all h-7"
          >
            <Code size={11} />
            片段
            <ChevronDown size={9} />
          </button>
          {showSnippetsMenu && (
            <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded-sm shadow-xl z-50 min-w-[220px] max-h-72 overflow-y-auto custom-scrollbar">
              {Object.entries(SNIPPET_GROUPS).map(([groupName, snippets]) => (
                <div key={groupName} className="border-b border-monokai-accent/20">
                  <button
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider bg-monokai-bg/85 hover:bg-monokai-yellow/10 transition-colors"
                    onClick={() => onSnippetCategoryToggle(expandedSnippetCategory === groupName ? null : groupName)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center">{SNIPPET_CATEGORY_META[groupName]?.icon || <FileText className="w-3.5 h-3.5" />}</span>
                      <span className={SNIPPET_CATEGORY_META[groupName]?.color || 'text-monokai-yellow/70'}>{groupName}</span>
                    </div>
                    <ChevronDown
                      size={9}
                      className={`transition-transform ${expandedSnippetCategory === groupName ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {expandedSnippetCategory === groupName && (
                    <div className="max-h-40 overflow-y-auto custom-scrollbar bg-monokai-bg/20">
                      {Object.entries(snippets).map(([label, snippet]) => (
                        <button
                          key={label}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-monokai-fg hover:bg-monokai-yellow/10 hover:text-monokai-yellow transition-colors flex items-center gap-1.5"
                          onClick={() => { onSnippetInsert(snippet); onSnippetsMenuToggle(); }}
                        >
                          <Code className="w-2.5 h-2.5 text-monokai-yellow/30 shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {showSnippetsMenu && <div className="fixed inset-0 z-40" onClick={onSnippetsMenuToggle} />}
        </div>

        {/* Materialize */}
        <div className="relative">
          <button
            onClick={onToggleMaterializeMenu}
            className="px-2 py-1 bg-monokai-purple/10 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/20 text-[11px] font-bold rounded-sm flex items-center gap-1 transition-all h-7"
          >
            <Save size={11} />
            物化
            <ChevronDown size={9} />
          </button>
          {showMaterializeMenu && (
            <div className="absolute top-full right-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded-sm shadow-xl z-50 min-w-[120px]">
              <button onClick={() => onOpenMaterializeModal('TABLE')} className="w-full text-left px-3 py-1.5 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">存为表</button>
              <button onClick={() => onOpenMaterializeModal('VIEW')} className="w-full text-left px-3 py-1.5 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">存为视图</button>
            </div>
          )}
          {showMaterializeMenu && <div className="fixed inset-0 z-40" onClick={onToggleMaterializeMenu} />}
        </div>

        {/* Compact Actions Separator */}
        <div className="flex items-center gap-0.5 border-l border-monokai-accent/30 pl-1.5 h-7 shrink-0">
          <button
            onClick={onFormatSql}
            className="p-1.5 text-monokai-yellow hover:text-monokai-fg hover:bg-monokai-yellow/10 rounded-sm transition-all"
            title="格式化 SQL"
          >
            <Type size={13} />
          </button>
          <button
            onClick={onSaveModal}
            className="p-1.5 text-monokai-orange hover:text-monokai-fg hover:bg-monokai-orange/10 rounded-sm transition-all"
            title="保存 SQL"
          >
            <Save size={13} />
          </button>
          <button
            onClick={onClear}
            className="p-1.5 text-monokai-pink hover:text-monokai-fg hover:bg-monokai-pink/10 rounded-sm transition-all"
            title="清空 SQL 区域"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={onToggleZen}
            className={`p-1.5 rounded-sm transition-all ${isZenMode ? 'bg-monokai-pink/20 text-monokai-pink' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-comment/10'}`}
            title="禅模式"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onToggleLivePreview}
            className={`p-1.5 rounded-sm transition-all ${showLivePreview ? 'bg-monokai-purple/20 text-monokai-purple' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-comment/10'}`}
            title="SQL 格式化预览"
          >
            <Eye size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

