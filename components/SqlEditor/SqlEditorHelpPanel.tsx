/**
 * SqlEditorHelpPanel — Sidebar "Help" tab
 *
 * Extracted from SqlEditor.tsx (Loop 4 of SqlEditor Pro refactor).
 *
 * Renders category-aware help content from `SQL_CATEGORY_HELP`. Several
 * sections are interactive:
 *   - Quick Start steps (where actionable) pre-fill the AI prompt input.
 *   - Scenarios / AI Prompts fill the AI prompt input on click.
 *   - DuckDB Syntax snippets append to the current SQL.
 */

import React from 'react';
import {
  Lightbulb, Zap, Target, Sparkles, Code, AlertTriangle, Wand2,
} from 'lucide-react';
import { SQL_CATEGORY_HELP, type SqlCategoryHelp } from '../../data/sqlEditorData';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import { highlightSql } from '../../utils';

export interface SqlEditorHelpPanelProps {
  /** Currently selected help category (e.g. "select" / "join"). */
  selectedSqlType: string;
  /** Called when the user changes the help category. */
  onSelectedSqlTypeChange: (v: string) => void;
}

export const SqlEditorHelpPanel: React.FC<SqlEditorHelpPanelProps> = ({
  selectedSqlType,
  onSelectedSqlTypeChange,
}) => {
  const setAiPrompt = useSqlEditorStore((s) => s.setAiPrompt);
  const updateActiveTab = useSqlEditorStore((s) => s.updateActiveTab);
  const getActiveTab = useSqlEditorStore((s) => s.getActiveTab);

  const help: SqlCategoryHelp | undefined = SQL_CATEGORY_HELP[selectedSqlType];

  const fillAiPrompt = (text: string) => setAiPrompt(text);
  const appendSnippet = (snippet: string) => {
    const tab = getActiveTab();
    if (!tab) return;
    updateActiveTab({
      code: tab.code + (tab.code.trim() ? '\n' : '') + snippet,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 pt-2 pb-1 border-b border-monokai-accent/30">
        <select
          value={selectedSqlType}
          onChange={(e) => onSelectedSqlTypeChange(e.target.value)}
          className="w-full bg-monokai-bg border border-monokai-accent/40 rounded px-2 py-1.5 text-[10px] text-monokai-fg outline-none focus:border-monokai-accent transition-colors"
        >
          <option value="select">▸ SELECT 查询生成</option>
          <option value="join">▸ JOIN 关联查询</option>
          <option value="aggregate">▸ 聚合 / 指标分析</option>
          <option value="transform">▸ 数据转换 / 清洗</option>
          <option value="performance">▸ 执行计划 / 性能优化</option>
          <option value="utilities">▸ 实用工具 / 测试数据</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!help ? null : (
          <div className="divide-y divide-monokai-accent/20">
            {/* Title + Description */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={11} className="text-monokai-yellow" />
                <span className="text-[11px] font-bold text-monokai-fg">{help.title}</span>
              </div>
              <p className="text-[10px] text-monokai-comment leading-relaxed">{help.description}</p>
            </div>

            {/* Quick Start */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={10} className="text-monokai-orange" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-orange/80">Quick Start</span>
                <div className="flex-1 h-px bg-monokai-accent/20" />
                <span className="text-[9px] text-monokai-comment/40">tap to fill</span>
              </div>
              <ol className="space-y-1">
                {help.quickStart.map((s, idx) => {
                  const stepText = s.replace(/^\d+\.\s*/, '');
                  const isActionable = /描述|输入|填写|说明/.test(stepText);
                  return (
                    <li
                      key={idx}
                      onClick={isActionable ? () => fillAiPrompt(stepText) : undefined}
                      className={`text-[10px] font-mono text-monokai-comment leading-relaxed flex items-start gap-1.5 ${isActionable ? 'cursor-pointer hover:text-monokai-orange hover:bg-monokai-orange/5 rounded px-1 py-0.5 transition-colors' : ''}`}
                    >
                      <span className="text-monokai-accent/60 shrink-0 mt-0.5 w-3 text-right">{idx + 1}</span>
                      <span>{stepText}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Scenarios */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={10} className="text-monokai-green" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-green/80">Scenarios</span>
                <div className="flex-1 h-px bg-monokai-accent/20" />
                <span className="text-[9px] text-monokai-comment/40">{help.scenarios.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {help.scenarios.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => fillAiPrompt(s)}
                    className="text-left text-[10px] text-monokai-comment leading-relaxed flex items-start gap-1.5 cursor-pointer hover:text-monokai-green hover:bg-monokai-green/5 rounded px-1 py-1 transition-colors group"
                  >
                    <span className="text-monokai-green/50 mt-0.5 shrink-0 group-hover:text-monokai-green">›</span>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Prompts */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={10} className="text-monokai-purple" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-purple/80">AI Prompts</span>
                <div className="flex-1 h-px bg-monokai-accent/20" />
                <span className="text-[9px] text-monokai-comment/40">{help.aiHints.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {help.aiHints.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => fillAiPrompt(s)}
                    className="text-left text-[10px] font-mono text-monokai-comment leading-relaxed flex items-start gap-1.5 cursor-pointer hover:text-monokai-purple hover:bg-monokai-purple/5 rounded px-1 py-1 transition-colors group"
                  >
                    <span className="text-monokai-purple/40 mt-0.5 shrink-0 group-hover:text-monokai-purple">→</span>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* DuckDB Syntax */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Code size={10} className="text-monokai-blue" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-blue/80">DuckDB Syntax</span>
                <div className="flex-1 h-px bg-monokai-accent/20" />
                <span className="text-[9px] text-monokai-comment/40">{help.duckdbSpecific.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {help.duckdbSpecific.map((s, idx) => {
                  const [code, ...desc] = s.split(' — ');
                  return (
                    <button
                      key={idx}
                      onClick={() => appendSnippet(code.trim())}
                      className="text-left rounded border border-monokai-accent/30 overflow-hidden hover:border-monokai-blue/50 hover:bg-monokai-blue/10 transition-colors group"
                    >
                      <div className="px-2 py-1.5 bg-monokai-bg">
                        <code className="text-[9px] font-mono text-monokai-blue leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightSql(code.trim()) }} />
                      </div>
                      {desc.length > 0 && (
                        <div className="px-2 py-1 bg-monokai-surface/40 border-t border-monokai-accent/20">
                          <span className="text-[9px] text-monokai-comment leading-relaxed">{desc.join(' — ')}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pitfalls */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={10} className="text-monokai-pink" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-pink/80">Pitfalls</span>
                <div className="flex-1 h-px bg-monokai-accent/20" />
                <span className="text-[9px] text-monokai-comment/40">{help.commonErrors.length}</span>
              </div>
              <div className="space-y-0.5">
                {help.commonErrors.map((s, idx) => (
                  <div key={idx} className="text-[10px] text-monokai-comment leading-relaxed flex items-start gap-1.5 px-1 py-0.5">
                    <span className="text-monokai-pink/60 mt-0.5 shrink-0">!</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Example Flows */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Wand2 size={10} className="text-monokai-accent" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-monokai-accent/80">Example Flows</span>
                <div className="flex-1 h-px bg-monokai-accent/20" />
              </div>
              <div className="flex flex-col gap-1">
                {help.exampleFlows.map((flow, idx) => (
                  <button
                    key={idx}
                    onClick={() => fillAiPrompt(`${flow.name}：${flow.description}`)}
                    className="w-full text-left flex items-start gap-2 px-2 py-1.5 bg-monokai-bg border border-monokai-accent/30 rounded hover:border-monokai-accent/60 hover:bg-monokai-accent/5 transition-colors group"
                  >
                    <span className="text-monokai-accent/50 group-hover:text-monokai-accent mt-0.5 shrink-0">▸</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium text-monokai-fg group-hover:text-monokai-accent transition-colors">{flow.name}</div>
                      <div className="text-[9px] text-monokai-comment mt-0.5 truncate">{flow.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SqlEditorHelpPanel;
