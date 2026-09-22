import React, { useState, useEffect } from 'react';
import { Sparkles, Code, Play, Check, Copy, Cpu, BookOpen, Target, Database, Tag, Zap } from 'lucide-react';
import { DuckDbQuickTemplate } from '../../data/duckdbTemplatesData';
import { CodeHighlightBlock } from '../ui/CodeHighlightBlock';
import { ModalShell, ActionButton } from '../ui/Workbench';
import { AH } from './analysisUi';

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

  const substitutedSql = template.sqlExample
    .replace(/\{table_name\}/g, tableNameParam)
    .replace(/\{column_name\}/g, colNameParam);

  const handleCopy = () => {
    void navigator.clipboard.writeText(substitutedSql);
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
          <span className="mr-auto flex items-center gap-2 font-mono text-meta text-monokai-comment">
            <Tag className="h-3 w-3 text-monokai-yellow" aria-hidden="true" />
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
            <ActionButton variant="success" icon={Zap} onClick={handleInsertAndRun}>
              插入并立即执行
            </ActionButton>
          )}
          <ActionButton variant="primary" icon={Play} onClick={handleInsert}>
            插入 SQL 编辑器
          </ActionButton>
        </>
      }
    >
      <div className="analysis-hub flex flex-col gap-2.5 text-meta">
        <div className="flex items-center gap-1.5 flex-wrap">
          {difficulty && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-mono font-semibold border ${difficulty.cls}`}
            >
              难度 · {difficulty.label}
            </span>
          )}
          {template.notesRef && (
            <span className={AH.badge}>
              <Database className="h-3 w-3" aria-hidden="true" />
              笔记 #{template.notesRef}
            </span>
          )}
          {(template as any).estimatedRows && (
            <span className={`${AH.badge} text-monokai-cyan border-monokai-cyan/30`}>
              预期 ~{(template as any).estimatedRows.toLocaleString()} 行
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className={`${AH.cardMuted} p-2.5`}>
            <div className={`${AH.label} mb-1 flex items-center gap-1.5 uppercase tracking-wider text-monokai-yellow`}>
              <Target className="h-3 w-3" aria-hidden="true" />
              模板用途
            </div>
            <div className={AH.body}>{template.purpose}</div>
          </div>

          <div className={`${AH.cardMuted} p-2.5`}>
            <div className={`${AH.label} mb-1 flex items-center gap-1.5 uppercase tracking-wider text-monokai-cyan`}>
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              适用场景
            </div>
            <div className={AH.body}>{applicableScenario}</div>
          </div>
        </div>

        <div className={`${AH.card} p-2.5 flex flex-col gap-2`}>
          <div className={`${AH.label} flex items-center gap-1.5 uppercase tracking-wider text-monokai-fg`}>
            <Cpu className="h-3 w-3 text-monokai-accent" aria-hidden="true" />
            上下文绑定
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={`${AH.label} block mb-1`}>
                表名 (<code className={AH.inlineCode}>{'{table_name}'}</code>)
              </label>
              <input
                type="text"
                value={tableNameParam}
                onChange={e => setTableNameParam(e.target.value)}
                onKeyDown={handleParamKeyDown}
                className={`w-full ${AH.input}`}
              />
            </div>

            <div>
              <label className={`${AH.label} block mb-1`}>
                字段 (<code className={AH.inlineCode}>{'{column_name}'}</code>)
              </label>
              {activeColumns.length > 0 ? (
                <select
                  value={colNameParam}
                  onChange={e => setColNameParam(e.target.value)}
                  onKeyDown={handleParamKeyDown}
                  className={`w-full ${AH.select}`}
                >
                  {activeColumns.map(col => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={colNameParam}
                  onChange={e => setColNameParam(e.target.value)}
                  onKeyDown={handleParamKeyDown}
                  className={`w-full ${AH.input}`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={`${AH.label} flex items-center gap-1 uppercase tracking-wider`}>
              <Code className="h-3 w-3" aria-hidden="true" />
              注入后的最终 SQL 代码
            </span>
            <button type="button" onClick={handleCopy} className={AH.btnGhost}>
              {copied ? (
                <Check className="h-3 w-3 text-monokai-green" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
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
