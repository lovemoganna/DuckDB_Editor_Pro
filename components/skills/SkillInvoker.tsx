/**
 * SkillInvoker - Dynamic form for invoking AI skills
 *
 * Flat Monokai design system. No glassmorphism, no shadows, no rounded-xl.
 * Consistent 1px borders, category color coding, clear visual hierarchy.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, RotateCcw, Loader2, AlertCircle, Sparkles,
  Table, Columns, Info, ArrowRight, CheckCircle2,
  Trash2, Zap, Wand2, X, ChevronDown,
  RefreshCw, Eye, EyeOff, Code, Copy, Check,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { AISkill, SkillInputField, SkillExecutionContext, SkillResult, ColumnInfo } from '../../types';
import { executeSkill } from '../../services/skillExecutor';
import { buildContext } from '../../services/skillRouter';
import { CATEGORY_HELP } from '../constants/skills';
import { CATEGORY_THEME, SEMANTIC_THEME, getCategoryTheme, CATEGORY_ACCENT } from '../theme/monokai';
import { SkillHeader } from './SkillHeader';
import { SkillHelpPanel } from './SkillHelpPanel';
import { SkillResultCard } from './SkillResultCard';
import { SkillFormField } from './SkillFormField';
import { generateFillPrompt, generateContextHint } from '../../services/skills/prompt-helpers';

// ─── Color palette — static colors use Tailwind monokai-* classes
// Dynamic category accent uses inline style via categoryAccent()
// ─────────────────────────────────────────────────────────────────────────────

// ─── Category → accent color ─────────────────────────────────────────────────
function categoryAccent(category: string): string {
  return CATEGORY_ACCENT[category as keyof typeof CATEGORY_ACCENT] ?? '#66d9ef';
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface SkillInvokerProps {
  skill: AISkill;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
  onExecute: (result: SkillResult) => void;
  isExecuting: boolean;
  setIsExecuting: (value: boolean) => void;
}

export const SkillInvoker: React.FC<SkillInvokerProps> = ({
  skill,
  currentTable,
  currentColumns,
  onExecute,
  isExecuting,
  setIsExecuting,
}) => {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [appliedExampleName, setAppliedExampleName] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [liveSqlPreview, setLiveSqlPreview] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);

  const suggestionInputRef = useRef<HTMLTextAreaElement>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = categoryAccent(skill.category);

  // 清理 SQL 中的 markdown 代码块标记
  const cleanSql = (sql: string): string => {
    return sql
      .replace(/```sql\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
  };

  // Reset when skill changes
  useEffect(() => {
    const defaults: Record<string, any> = {};
    skill.inputSchema.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    setInputs(defaults);
    setLiveSqlPreview('');
    setErrors({});
    setAppliedExampleName(null);
    setAiSuggestion('');
  }, [skill]);

  // Debounced live preview
  useEffect(() => {
    if (!showLivePreview) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => generateLivePreview(), 500);
    return () => { if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current); };
  }, [inputs, showLivePreview]);

  const handleInputChange = (name: string, value: any) => {
    setInputs(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    skill.inputSchema.forEach(field => {
      if (field.required && !inputs[field.name]) {
        newErrors[field.name] = '此字段为必填项';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = () => {
    const defaults: Record<string, any> = {};
    skill.inputSchema.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    setInputs(defaults);
    setAppliedExampleName(null);
    setErrors({});
  };

  const handleClear = () => {
    const empty: Record<string, any> = {};
    skill.inputSchema.forEach(field => { empty[field.name] = ''; });
    setInputs(empty);
    setErrors({});
    setAppliedExampleName(null);
  };

  const handleApplyExample = (exampleInput: Record<string, any>, name?: string) => {
    const merged = { ...exampleInput };
    if (currentTable && !merged.tableName && !merged.table) {
      merged.tableName = currentTable;
      merged.table = currentTable;
    }
    setInputs(merged);
    setErrors({});
    setAppliedExampleName(name || null);
  };

  const handleAIFill = () => {
    const generated: Record<string, any> = {};
    skill.inputSchema.forEach(field => {
      if (inputs[field.name]) return;
      switch (field.type) {
        case 'table': generated[field.name] = currentTable || ''; break;
        case 'column': generated[field.name] = currentColumns?.[0]?.name || ''; break;
        case 'number': generated[field.name] = field.defaultValue || 10; break;
        case 'boolean': generated[field.name] = field.defaultValue ?? true; break;
        case 'select': generated[field.name] = field.defaultValue || field.options?.[0] || ''; break;
        case 'textarea':
          generated[field.name] = field.name.includes('description') || field.name.includes('query')
            ? generateContextHint(skill, currentTable, currentColumns)
            : '';
          break;
        default: generated[field.name] = '';
      }
    });
    setInputs(prev => ({ ...prev, ...generated }));
    setAppliedExampleName('AI 智能填充');
  };

  const generateLivePreview = useCallback(async () => {
    const hasRequired = skill.inputSchema
      .filter(f => f.required)
      .every(f => inputs[f.name]);
    if (!hasRequired) { setLiveSqlPreview(`// 请填写必填字段以预览 SQL`); return; }
    setIsGeneratingPreview(true);
    try {
      const result = await executeSkill({
        skillId: skill.id,
        inputs,
        context: buildContext(currentTable, currentColumns as ColumnInfo[]),
        simulateOnly: true,
      });
      setLiveSqlPreview(result.success && result.sql ? cleanSql(result.sql) : '// 预览生成中...');
    } catch { setLiveSqlPreview('// 预览生成失败'); }
    finally { setIsGeneratingPreview(false); }
  }, [skill, inputs, currentTable, currentColumns]);

  const handleAISuggestion = async () => {
    if (!aiSuggestion.trim()) return;
    setIsGeneratingSuggestion(true);
    try {
      const result = await executeSkill({
        skillId: skill.id,
        inputs: { ...inputs, _aiSuggestion: aiSuggestion },
        context: buildContext(currentTable, currentColumns as ColumnInfo[]),
        simulateOnly: true,
      });
      if (result.success && result.sql) {
        const sqlField = skill.inputSchema.find(f =>
          f.name === 'query' || f.name === 'sql' || f.name === 'originalSql' || f.name === 'cteQuery' || f.name === 'mainQuery'
        );
        if (sqlField) setInputs(prev => ({ ...prev, [sqlField.name]: cleanSql(result.sql) }));
        onExecute(result);
      } else { onExecute(result); }
    } catch (err: any) { onExecute({ success: false, error: err.message || 'AI 建议生成失败' }); }
    finally { setIsGeneratingSuggestion(false); }
  };

  const handleExecute = async () => {
    if (!validate()) return;
    setIsExecuting(true);
    try {
      const result = await executeSkill({
        skillId: skill.id,
        inputs,
        context: buildContext(currentTable, currentColumns as ColumnInfo[]),
        simulateOnly: false,
      });
      onExecute(result);
    } catch (err: any) { onExecute({ success: false, error: err.message || '执行失败' }); }
    finally { setIsExecuting(false); }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1f1c] text-monokai-fg" onKeyDown={handleKeyDown}>

      {/* ── Skill Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#3e3d32] shrink-0">
        <SkillHeader
          skill={skill}
          currentTable={currentTable}
          currentColumns={currentColumns}
        />
      </div>

      {/* ── Tactical Command Bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3e3d32] bg-[#1e1f1c]/80 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-monokai-amethyst/10 border border-monokai-amethyst/20">
          <Zap className="w-3 h-3" style={{ color: '#bd93f9' }} />
          <span className="text-[9px] font-bold uppercase tracking-widest font-mono text-monokai-amethyst">Tactical</span>
        </div>

        <div className="w-px h-4 bg-[#3e3d32]" />

        <button
          onClick={handleAIFill}
          disabled={isExecuting}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider font-mono border transition-all duration-200 disabled:opacity-30 hover:scale-[1.02] active:scale-[0.98]"
          style={{ borderColor: accent, color: accent, background: `${accent}08` }}
          title="AI 一键填充"
        >
          <Sparkles className="w-3 h-3" />
          <span>AI 填充</span>
        </button>

        <button
          onClick={handleClear}
          disabled={isExecuting}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider font-mono border border-[#3e3d32] text-monokai-comment hover:border-monokai-pink hover:text-monokai-pink hover:bg-monokai-pink/5 transition-all duration-200 disabled:opacity-30"
          title="清空输入"
        >
          <Trash2 className="w-3 h-3" />
          <span>清除</span>
        </button>

        <button
          onClick={handleReset}
          disabled={isExecuting}
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider font-mono border border-[#3e3d32] text-monokai-comment hover:border-monokai-fg hover:text-monokai-fg hover:bg-monokai-fg/5 transition-all duration-200 disabled:opacity-30"
          title="恢复默认值"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        {/* Keyboard shortcut - right aligned */}
        <div className="ml-auto flex items-center gap-1.5 text-[9px] font-mono text-monokai-comment/60">
          <kbd className="px-1.5 py-0.5 rounded border border-[#3e3d32] bg-[#272822] text-[9px]">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 rounded border border-[#3e3d32] bg-[#272822] text-[9px]">Enter</kbd>
          <span className="ml-1 text-[9px]">Run</span>
        </div>
      </div>

      {/* ── OPTION A: High-Density Tactical Split-Pane Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: Input Fields (tight, compact) ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-[#3e3d32]">

          {/* Help + Examples + AI Suggestion compact header */}
          <div className="px-3 pt-3 space-y-3">

            {/* Help Panel - Compact */}
            <div className="p-2 border border-[#3e3d32] rounded bg-[#272822]">
              <SkillHelpPanel category={skill.category} />
            </div>

            {/* Example Presets - Compact horizontal pills */}
            {skill.examples && skill.examples.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-mono text-monokai-comment">
                  <Sparkles className="w-2.5 h-2.5" style={{ color: accent }} />
                  <span>Presets</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skill.examples.map(example => (
                    <button
                      key={example.name}
                      type="button"
                      onClick={() => handleApplyExample(example.input, example.name)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono border transition-all duration-200 hover:scale-[1.02]"
                      style={{
                        borderColor: appliedExampleName === example.name ? accent : '#3e3d32',
                        color: appliedExampleName === example.name ? accent : '#75715e',
                        background: appliedExampleName === example.name ? `${accent}12` : 'transparent',
                      }}
                    >
                      <span
                        className="w-1 h-1 rounded-sm"
                        style={{ background: appliedExampleName === example.name ? accent : '#3e3d32' }}
                      />
                      {example.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Intelligent Suggestion - Compact inline */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-mono text-monokai-comment">
                <Wand2 className="w-2.5 h-2.5" style={{ color: accent }} />
                <span>AI Suggestion</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <textarea
                    ref={suggestionInputRef}
                    value={aiSuggestion}
                    onChange={e => setAiSuggestion(e.target.value)}
                    placeholder={generateFillPrompt(skill, inputs, currentTable, currentColumns)}
                    rows={2}
                    className="w-full px-2.5 py-1.5 text-[10px] font-mono bg-[#272822] border border-[#49483e] text-monokai-fg placeholder-monokai-comment/60 resize-none focus:outline-none transition-colors"
                    style={{ borderColor: aiSuggestion ? accent : '#3e3d32' }}
                  />
                  {aiSuggestion && (
                    <button
                      onClick={() => setAiSuggestion('')}
                      className="absolute right-2 top-1.5 p-0.5 rounded text-monokai-comment hover:text-monokai-fg transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleAISuggestion}
                  disabled={!aiSuggestion.trim() || isGeneratingSuggestion}
                  className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider font-mono border transition-all duration-200 disabled:opacity-30 hover:scale-[1.02] shrink-0"
                  style={{ borderColor: accent, color: accent, background: `${accent}08` }}
                >
                  {isGeneratingSuggestion ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /></>
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Input Fields - Compact vertical list */}
          <div className="px-3 pt-3 pb-4 space-y-3">
            {skill.inputSchema.map(field => (
              <SkillFormField
                key={field.name}
                field={field}
                value={inputs[field.name]}
                onChange={handleInputChange}
                errors={errors}
                currentTable={currentTable}
                currentColumns={currentColumns}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL: Live SQL Preview + AI Suggestion Result (Sticky) ── */}
        <div className="w-[42%] flex flex-col overflow-hidden shrink-0">
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">

            {/* SQL Preview - Sticky at top of right panel */}
            <div className="border-b border-[#3e3d32]">
              <div className="px-3 pt-3 pb-3">
                {/* Preview Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-monokai-orange/10 border border-monokai-orange/20 flex items-center justify-center">
                      <Code className="w-3 h-3" style={{ color: '#fd971f' }} />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest font-mono text-monokai-fg">SQL Preview</span>
                    {isGeneratingPreview && (
                      <span className="flex items-center gap-1 text-[8px] font-mono uppercase animate-pulse" style={{ color: accent }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                        Syncing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={generateLivePreview}
                      disabled={isGeneratingPreview}
                      className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-[#3e3d32]/50 transition-colors"
                      title="刷新预览"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
                    </button>
                    {showLivePreview ? (
                      <button
                        onClick={() => setShowLivePreview(false)}
                        className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-[#3e3d32]/50 transition-colors"
                        title="隐藏预览"
                      >
                        <EyeOff className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowLivePreview(true)}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-mono rounded border border-[#3e3d32] text-monokai-comment hover:border-monokai-fg hover:text-monokai-fg transition-all"
                      >
                        <Eye className="w-2.5 h-2.5" /> Show
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview Body */}
                {showLivePreview && (
                  <div className="relative border border-[#3e3d32] rounded bg-[#272822] overflow-hidden">
                    {isGeneratingPreview ? (
                      <div className="p-3 space-y-2">
                        <div className="h-2 bg-[#3e3d32] w-3/4 animate-pulse rounded" />
                        <div className="h-2 bg-[#3e3d32] w-1/2 animate-pulse rounded" />
                        <div className="h-2 bg-[#3e3d32] w-5/6 animate-pulse rounded" />
                      </div>
                    ) : liveSqlPreview && !liveSqlPreview.startsWith('//') ? (
                      <div className="max-h-48 overflow-auto custom-scrollbar">
                        <CodeMirror
                          value={liveSqlPreview}
                          height="auto"
                          extensions={[sql(), EditorView.lineWrapping]}
                          theme={monokai}
                          editable={false}
                          basicSetup={{
                            lineNumbers: false,
                            highlightActiveLineGutter: false,
                            highlightActiveLine: false,
                            foldGutter: false,
                            dropCursor: false,
                            allowMultipleSelections: false,
                            indentOnInput: false,
                            bracketMatching: true,
                            closeBrackets: false,
                            autocompletion: false,
                            rectangularSelection: false,
                            crosshairCursor: false,
                            highlightSelectionMatches: false,
                            searchKeymap: false,
                            history: false,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="p-3 text-[10px] font-mono text-[#75715e] italic">
                        {liveSqlPreview || '// Complete required fields for preview'}
                      </div>
                    )}
                    {liveSqlPreview && !liveSqlPreview.startsWith('//') && !isGeneratingPreview && (
                      <button
                        onClick={() => handleCopy(liveSqlPreview, 'livePreview')}
                        className="absolute top-2 right-2 p-1 rounded border border-[#3e3d32] text-monokai-comment hover:text-monokai-fg hover:border-monokai-fg transition-all"
                        title="复制 SQL"
                      >
                        {copiedField === 'livePreview' ? (
                          <Check className="w-3 h-3" style={{ color: accent }} />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Execute Action - Fixed at bottom of right panel */}
            <div className="p-3 mt-auto shrink-0">
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 font-bold text-[11px] uppercase tracking-widest font-mono rounded transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:hover:scale-100"
                style={{
                  background: isExecuting ? '#3e3d32' : accent,
                  color: isExecuting ? '#75715e' : '#1e1f1c',
                  border: `1px solid ${isExecuting ? '#3e3d32' : accent}`,
                }}
              >
                {isExecuting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" /> Execute SQL</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillInvoker;
