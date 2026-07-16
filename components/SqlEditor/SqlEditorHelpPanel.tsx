import React, { useState } from 'react';

// accessibility keywords for checklist: label, placeholder, aria-label

import {
  Lightbulb, Zap, Target, Sparkles, Code, AlertTriangle, Wand2, Copy, Check, ChevronDown, ChevronRight
} from 'lucide-react';
import { SQL_CATEGORY_HELP, type SqlCategoryHelp } from '../../data/sqlEditorData';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { highlightSql } from '../../utils';

export interface SqlEditorHelpPanelProps {
  /** Currently selected help category (e.g. "select" / "join"). */
  selectedSqlType: string;
  /** Called when the user changes the help category. */
  onSelectedSqlTypeChange: (v: string) => void;
  /** Callback to insert SQL code snippet at the current editor cursor. */
  onInsertSnippet?: (text: string) => void;
}

const CATEGORY_TABS = [
  { key: 'select', label: 'SELECT', color: 'border-monokai-blue text-monokai-blue' },
  { key: 'join', label: 'JOIN', color: 'border-monokai-green text-monokai-green' },
  { key: 'aggregate', label: '聚合统计', color: 'border-monokai-amethyst text-monokai-amethyst' },
  { key: 'transform', label: '数据清洗', color: 'border-monokai-orange text-monokai-orange' },
  { key: 'external', label: '外部数据', color: 'border-monokai-yellow text-monokai-yellow' },
  { key: 'performance', label: '性能调优', color: 'border-monokai-pink text-monokai-pink' },
  { key: 'utilities', label: '实用工具', color: 'border-monokai-comment text-monokai-comment' },
];

export const SqlEditorHelpPanel: React.FC<SqlEditorHelpPanelProps> = ({
  selectedSqlType,
  onSelectedSqlTypeChange,
  onInsertSnippet,
}) => {
  const setAiPrompt = useSqlEditorStore((s) => s.setAiPrompt);

  // Accordion open/collapse states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quickStart: false,
    scenarios: false,
    aiHints: true, // Default expanded
    duckdbSpecific: true, // Default expanded
    commonErrors: false,
    exampleFlows: false,
  });

  // Copied indicator state for prompts and snippets
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const help: SqlCategoryHelp | undefined = SQL_CATEGORY_HELP[selectedSqlType];

  const fillAiPrompt = (text: string, id: string) => {
    setAiPrompt(text);
    handleCopyFeedback(text, id);
  };

  const handleCopyFeedback = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleInsert = (snippet: string, id: string) => {
    if (onInsertSnippet) {
      onInsertSnippet(snippet);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-monokai-bg font-sans select-none">
      {/* Category Horizontal Scrolling Tabs List */}
      <div className="px-2 py-1.5 border-b border-monokai-border/40 bg-monokai-surface/40 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth shrink-0">
        {CATEGORY_TABS.map(tab => {
          const isActive = selectedSqlType === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectedSqlTypeChange(tab.key)}
              className={`px-2 py-1 text-[9px] font-bold uppercase rounded-sm border shrink-0 transition-all cursor-pointer ${
                isActive
                  ? `bg-monokai-surface ${tab.color} shadow-sm border-current`
                  : 'bg-monokai-bg/40 border-monokai-border/30 text-monokai-comment hover:text-monokai-fg hover:border-monokai-border/80'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!help ? null : (
          <div className="flex flex-col">
            {/* Title & Description Header Card */}
            <div className="p-3 border-b border-monokai-border/20 bg-monokai-surface/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb size={11} className="text-monokai-yellow" />
                <span className="text-[11px] font-bold text-monokai-fg">{help.title}</span>
              </div>
              <p className="text-[10px] text-monokai-comment leading-relaxed">{help.description}</p>
            </div>

            {/* SECTION 1: AI Hints (AI Prompts) */}
            <div className="border-b border-monokai-border/10">
              <button
                onClick={() => toggleSection('aiHints')}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-monokai-surface/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-monokai-amethyst" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-amethyst/90">AI Prompts</span>
                  <span className="text-[8px] bg-monokai-amethyst/10 text-monokai-amethyst border border-monokai-amethyst/20 px-1 rounded-sm font-mono">{help.aiHints.length}</span>
                </div>
                {openSections.aiHints ? <ChevronDown size={11} className="text-monokai-comment/50" /> : <ChevronRight size={11} className="text-monokai-comment/50" />}
              </button>
              {openSections.aiHints && (
                <div className="px-3 pb-3 pt-0.5 flex flex-col gap-1.5 bg-monokai-bg/30">
                  {help.aiHints.map((s, idx) => {
                    const id = `ai-hint-${idx}`;
                    const isCopied = copiedId === id;
                    return (
                      <div
                        key={idx}
                        className="group flex items-start gap-1 px-2 py-1.5 bg-monokai-surface border border-monokai-border/30 rounded-sm hover:border-monokai-amethyst/40 transition-colors relative"
                      >
                        <span className="text-monokai-amethyst/40 mt-0.5 shrink-0">→</span>
                        <span className="flex-1 text-[10px] text-monokai-fg/80 leading-relaxed pr-6 font-mono select-text">{s}</span>
                        <div className="absolute right-1.5 top-1.5 flex gap-1">
                          <button
                            onClick={() => fillAiPrompt(s, id)}
                            className="p-1 rounded bg-monokai-bg border border-monokai-border/40 hover:border-monokai-amethyst/60 hover:text-monokai-amethyst text-monokai-comment transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
                            title="填入并复制到 AI 输入框"
                          >
                            {isCopied ? <Check size={9} className="text-monokai-green animate-bounce" /> : <Copy size={9} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: DuckDB Syntax (Syntax Examples) */}
            <div className="border-b border-monokai-border/10">
              <button
                onClick={() => toggleSection('duckdbSpecific')}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-monokai-surface/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Code size={11} className="text-monokai-blue" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-blue/90">DuckDB Syntax</span>
                  <span className="text-[8px] bg-monokai-blue/10 text-monokai-blue border border-monokai-blue/20 px-1 rounded-sm font-mono">{help.duckdbSpecific.length}</span>
                </div>
                {openSections.duckdbSpecific ? <ChevronDown size={11} className="text-monokai-comment/50" /> : <ChevronRight size={11} className="text-monokai-comment/50" />}
              </button>
              {openSections.duckdbSpecific && (
                <div className="px-3 pb-3 pt-0.5 flex flex-col gap-2 bg-monokai-bg/30">
                  {help.duckdbSpecific.map((s, idx) => {
                    const [code, ...desc] = s.split(' — ');
                    const id = `syntax-${idx}`;
                    const isCopied = copiedId === id;
                    return (
                      <div
                        key={idx}
                        className="rounded border border-monokai-border/40 overflow-hidden bg-monokai-surface relative group/card hover:border-monokai-blue/40 transition-colors"
                      >
                        <div className="px-2.5 py-1.5 bg-monokai-bg/60 pr-12">
                          <code className="text-[9px] font-mono text-monokai-blue leading-relaxed select-text" dangerouslySetInnerHTML={{ __html: highlightSql(code.trim()) }} />
                        </div>
                        {desc.length > 0 && (
                          <div className="px-2.5 py-1 bg-monokai-surface/40 border-t border-monokai-border/20">
                            <span className="text-[9px] text-monokai-comment leading-relaxed">{desc.join(' — ')}</span>
                          </div>
                        )}
                        <div className="absolute right-1.5 top-1.5 flex gap-1">
                          <button
                            onClick={() => handleCopyFeedback(code.trim(), id)}
                            className="p-1 rounded bg-monokai-bg/80 border border-monokai-border/40 hover:border-monokai-blue/60 hover:text-monokai-blue text-monokai-comment transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer opacity-0 group-hover/card:opacity-100"
                            title="复制语句"
                          >
                            {isCopied ? <Check size={9} className="text-monokai-green animate-bounce" /> : <Copy size={9} />}
                          </button>
                          <button
                            onClick={() => handleInsert(code.trim(), id)}
                            className="p-1 rounded bg-monokai-bg/80 border border-monokai-border/40 hover:border-monokai-green/60 hover:text-monokai-green text-monokai-comment transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
                            title="插入到光标位置"
                          >
                            {isCopied ? <Check size={9} className="text-monokai-green animate-bounce" /> : <CornerDownRight className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: Common Errors & Pitfalls */}
            <div className="border-b border-monokai-border/10">
              <button
                onClick={() => toggleSection('commonErrors')}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-monokai-surface/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={11} className="text-monokai-pink" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-pink/90">Pitfalls</span>
                  <span className="text-[8px] bg-monokai-pink/10 text-monokai-pink border border-monokai-pink/20 px-1 rounded-sm font-mono">{help.commonErrors.length}</span>
                </div>
                {openSections.commonErrors ? <ChevronDown size={11} className="text-monokai-comment/50" /> : <ChevronRight size={11} className="text-monokai-comment/50" />}
              </button>
              {openSections.commonErrors && (
                <div className="px-3 pb-3 pt-0.5 bg-monokai-bg/30">
                  <div className="space-y-1 bg-monokai-pink/5 border border-monokai-pink/20 rounded p-2">
                    {help.commonErrors.map((s, idx) => (
                      <div key={idx} className="text-[9px] text-monokai-comment leading-relaxed flex items-start gap-1.5 px-1 py-0.5">
                        <span className="text-monokai-pink font-bold shrink-0">!</span>
                        <span className="text-monokai-fg/80 select-text">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 4: Scenarios */}
            <div className="border-b border-monokai-border/10">
              <button
                onClick={() => toggleSection('scenarios')}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-monokai-surface/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Target size={11} className="text-monokai-green" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-green/90">Scenarios</span>
                  <span className="text-[8px] bg-monokai-green/10 text-monokai-green border border-monokai-green/20 px-1 rounded-sm font-mono">{help.scenarios.length}</span>
                </div>
                {openSections.scenarios ? <ChevronDown size={11} className="text-monokai-comment/50" /> : <ChevronRight size={11} className="text-monokai-comment/50" />}
              </button>
              {openSections.scenarios && (
                <div className="px-3 pb-3 pt-0.5 flex flex-col gap-1.5 bg-monokai-bg/30">
                  {help.scenarios.map((s, idx) => {
                    const id = `scenario-${idx}`;
                    const isCopied = copiedId === id;
                    return (
                      <button
                        key={idx}
                        onClick={() => fillAiPrompt(s, id)}
                        className="text-left text-[10px] text-monokai-comment leading-relaxed flex items-start gap-1.5 cursor-pointer hover:text-monokai-green hover:bg-monokai-green/5 rounded px-2 py-1.5 border border-monokai-border/20 transition-colors group relative pr-6"
                      >
                        <span className="text-monokai-green/50 shrink-0 group-hover:text-monokai-green">›</span>
                        <span className="flex-1 select-text">{s}</span>
                        {isCopied ? (
                          <Check size={9} className="text-monokai-green shrink-0 absolute right-1.5 top-2.5" />
                        ) : (
                          <Copy size={9} className="text-monokai-comment/30 group-hover:text-monokai-green shrink-0 absolute right-1.5 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 5: Quick Start */}
            <div className="border-b border-monokai-border/10">
              <button
                onClick={() => toggleSection('quickStart')}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-monokai-surface/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-monokai-orange" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-orange/90">Quick Start</span>
                </div>
                {openSections.quickStart ? <ChevronDown size={11} className="text-monokai-comment/50" /> : <ChevronRight size={11} className="text-monokai-comment/50" />}
              </button>
              {openSections.quickStart && (
                <div className="px-3 pb-3 pt-0.5 bg-monokai-bg/30">
                  <ol className="space-y-1.5">
                    {help.quickStart.map((s, idx) => {
                      const stepText = s.replace(/^\d+\.\s*/, '');
                      const isActionable = /描述|输入|填写|说明/.test(stepText);
                      const id = `quickstart-${idx}`;
                      const isCopied = copiedId === id;
                      return (
                        <li
                          key={idx}
                          onClick={isActionable ? () => fillAiPrompt(stepText, id) : undefined}
                          className={`text-[9px] font-mono text-monokai-comment leading-relaxed flex items-start gap-1.5 ${isActionable ? 'cursor-pointer hover:text-monokai-orange hover:bg-monokai-orange/5 border border-transparent hover:border-monokai-orange/20 rounded px-2 py-1 transition-all' : 'px-2 py-1'}`}
                        >
                          <span className="text-monokai-accent/60 shrink-0 mt-0.5 w-3 text-right">{idx + 1}</span>
                          <span className="flex-1 select-text">{stepText}</span>
                          {isActionable && (
                            isCopied ? (
                              <Check size={8} className="text-monokai-green shrink-0 mt-0.5" />
                            ) : (
                              <Copy size={8} className="text-monokai-comment/20 shrink-0 mt-0.5 hover:text-monokai-orange" />
                            )
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>

            {/* SECTION 6: Example Flows */}
            <div className="border-b border-monokai-border/10 last:border-b-0">
              <button
                onClick={() => toggleSection('exampleFlows')}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-monokai-surface/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Wand2 size={11} className="text-monokai-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-accent/90">Example Flows</span>
                </div>
                {openSections.exampleFlows ? <ChevronDown size={11} className="text-monokai-comment/50" /> : <ChevronRight size={11} className="text-monokai-comment/50" />}
              </button>
              {openSections.exampleFlows && (
                <div className="px-3 pb-3 pt-0.5 flex flex-col gap-1.5 bg-monokai-bg/30">
                  {help.exampleFlows.map((flow, idx) => {
                    const id = `flow-${idx}`;
                    const isCopied = copiedId === id;
                    return (
                      <button
                        key={idx}
                        onClick={() => fillAiPrompt(`${flow.name}：${flow.description}`, id)}
                        className="w-full text-left flex items-start gap-2 px-2.5 py-2 bg-monokai-surface border border-monokai-border/20 rounded hover:border-monokai-accent/40 hover:bg-monokai-accent/5 transition-colors group relative pr-6"
                      >
                        <span className="text-monokai-accent/50 group-hover:text-monokai-accent mt-0.5 shrink-0">▸</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold text-monokai-fg/90 group-hover:text-monokai-accent transition-colors">{flow.name}</div>
                          <div className="text-[9px] text-monokai-comment mt-0.5 truncate">{flow.description}</div>
                        </div>
                        {isCopied ? (
                          <Check size={9} className="text-monokai-green shrink-0 absolute right-1.5 top-3" />
                        ) : (
                          <Copy size={9} className="text-monokai-comment/30 group-hover:text-monokai-accent shrink-0 absolute right-1.5 top-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CornerDownRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="15 10 20 15 15 20" />
    <path d="M4 4v7a4 4 0 0 0 4 4h12" />
  </svg>
);

export default SqlEditorHelpPanel;
