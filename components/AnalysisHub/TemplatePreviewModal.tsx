import React, { useState, useEffect } from 'react';
import { Sparkles, Code, Play, Check, Copy, Cpu, BookOpen, Target, Database, Tag, Zap } from 'lucide-react';
import { DuckDbQuickTemplate } from '../../data/duckdbTemplatesData';
import { CodeHighlightBlock } from '../ui/CodeHighlightBlock';
import { ModalShell, ActionButton } from '../ui/Workbench';

interface TemplatePreviewModalProps {
  template: DuckDbQuickTemplate | null;
  currentTable: string | null;
  activeColumns: string[];
  onClose: () => void;
  onApplyTemplate: (sql: string) => void;
  onApplyAndExecute?: (sql: string) => void;
}

const DIFFICULTY_TONE: Record<string, { label: string; cls: string }> = {
  beginner: { label: '入门', cls: 'bg-monokai-green/15 text-monokai-green border-monokai-green/35' },
  intermediate: { label: '进阶', cls: 'bg-monokai-yellow/15 text-monokai-yellow border-monokai-yellow/35' },
  advanced: { label: '高阶', cls: 'bg-monokai-pink/15 text-monokai-pink border-monokai-pink/35' },
};

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  currentTable,
  activeColumns,
  onClose,
  onApplyTemplate,
  onApplyAndExecute,
}) => {
  const [tableNameParam, setTableNameParam] = useState(currentTable || 'table_name');
  const [colNameParam, setColNameParam] = useState(activeColumns[0] || 'column_name');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTableNameParam(currentTable || 'table_name');
    setColNameParam(activeColumns[0] || 'column_name');
  }, [template, currentTable, activeColumns]);

  if (!template) return null;

  // Substitute {table_name} and {column_name} in template example
  const substitutedSql = template.sqlExample
    .replace(/\{table_name\}/g, tableNameParam)
    .replace(/\{column_name\}/g, colNameParam);

  const handleCopy = () => {
    navigator.clipboard.writeText(substitutedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onApplyTemplate(substitutedSql);
    onClose();
  };

  const handleInsertAndRun = () => {
    if (onApplyAndExecute) {
      onApplyAndExecute(substitutedSql);
    } else {
      onApplyTemplate(substitutedSql);
    }
    onClose();
  };

  const handleParamKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    }
  };

  const difficulty = (template as any).difficulty
    ? DIFFICULTY_TONE[(template as any).difficulty as string] || DIFFICULTY_TONE.intermediate
    : null;

  const applicableScenario = (template as any).applicableScenario || template.purpose;

  return (
    <ModalShell
      open={Boolean(template)}
      onClose={onClose}
      title={template.title}
      description={template.purpose}
      icon={BookOpen}
      iconColor="text-monokai-accent"
      badge={template.categoryLabel}
      size="lg"
      closeLabel="关闭模板预览"
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 font-mono text-[11px] text-monokai-comment">
            <Tag className="h-3 w-3 text-monokai-yellow" />
            <span className="flex gap-1 flex-wrap">
              {template.tags.slice(0, 3).map(t => (
                <span key={t} className="text-monokai-yellow font-mono">
                  #{t}
                </span>
              ))}
              {template.tags.length > 3 && (
                <span className="text-monokai-comment/65">+{template.tags.length - 3}</span>
              )}
            </span>
          </span>
          <ActionButton variant="secondary" onClick={onClose}>
            取消
          </ActionButton>
          {onApplyAndExecute && (
            <ActionButton
              variant="success"
              icon={Zap}
              onClick={handleInsertAndRun}
            >
              插入并立即执行
            </ActionButton>
          )}
          <ActionButton variant="primary" icon={Play} onClick={handleInsert}>
            插入 SQL 编辑器
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* 顶部元数据卡片 */}
        <div className="flex items-center gap-2 flex-wrap">
          {difficulty && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${difficulty.cls}`}>
              难度 · {difficulty.label}
            </span>
          )}
          {template.notesRef && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] text-monokai-comment bg-monokai-surface border border-monokai-border/60">
              <Database className="h-3 w-3" />
              笔记 #{template.notesRef}
            </span>
          )}
          {(template as any).estimatedRows && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] text-monokai-cyan bg-monokai-cyan/10 border border-monokai-cyan/30">
              预期 ~{(template as any).estimatedRows.toLocaleString()} 行
            </span>
          )}
        </div>

        {/* 用途 + 场景双卡 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-monokai-surface/60 p-3 rounded-lg border border-monokai-border/80">
            <div className="text-[10px] font-bold text-monokai-yellow uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
              <Target className="h-3 w-3" />
              模板用途与功能
            </div>
            <div className="text-monokai-fg/90 text-[11px] leading-relaxed">
              {template.purpose}
            </div>
          </div>

          <div className="bg-monokai-surface/60 p-3 rounded-lg border border-monokai-border/80">
            <div className="text-[10px] font-bold text-monokai-cyan uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
              <Sparkles className="h-3 w-3" />
              最佳适用场景
            </div>
            <div className="text-monokai-fg/90 text-[11px] leading-relaxed">
              {applicableScenario}
            </div>
          </div>
        </div>

        {/* 上下文参数绑定 */}
        <div className="p-3.5 bg-monokai-surface/80 border border-monokai-border rounded-lg flex flex-col gap-2.5">
          <div className="text-[10.5px] font-semibold text-monokai-fg uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Cpu className="h-3 w-3 text-monokai-accent" />
            智能上下文绑定 (根据当前数据库自动注入)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-monokai-comment mb-1 font-mono">
                绑定表名 (<code className="text-monokai-accent">{'{table_name}'}</code>)
              </label>
              <input
                type="text"
                value={tableNameParam}
                onChange={(e) => setTableNameParam(e.target.value)}
                onKeyDown={handleParamKeyDown}
                className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] text-monokai-comment mb-1 font-mono">
                绑定核心字段 (<code className="text-monokai-accent">{'{column_name}'}</code>)
              </label>
              {activeColumns.length > 0 ? (
                <select
                  value={colNameParam}
                  onChange={(e) => setColNameParam(e.target.value)}
                  onKeyDown={handleParamKeyDown}
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 font-mono transition-all cursor-pointer"
                >
                  {activeColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={colNameParam}
                  onChange={(e) => setColNameParam(e.target.value)}
                  onKeyDown={handleParamKeyDown}
                  className="w-full bg-monokai-bg border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-monokai-fg outline-none focus:border-monokai-accent focus:ring-1 focus:ring-monokai-accent/30 font-mono transition-all"
                />
              )}
            </div>
          </div>
        </div>

        {/* SQL 代码预览 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-1 font-mono">
              <Code className="h-3 w-3" />
              注入后的最终 SQL 代码
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-monokai-comment hover:text-monokai-cyan hover:bg-monokai-cyan/10 border border-transparent hover:border-monokai-cyan/40 transition-all"
            >
              {copied ? <Check className="h-3 w-3 text-monokai-green" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? '已复制' : '复制 SQL'}</span>
            </button>
          </div>
          <CodeHighlightBlock
            code={substitutedSql}
            language="sql"
            title={template.title}
            maxHeight="220px"
            allowFormat={true}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </ModalShell>
  );
};

export default TemplatePreviewModal;