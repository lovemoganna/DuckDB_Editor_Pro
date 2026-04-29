/**
 * SandboxEditor — 实验台 SQL 编辑器
 */

import React, { useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { useAbstractionSandbox } from '../../hooks/useAbstractionSandbox';

export const SandboxEditor: React.FC = () => {
  const { sandboxSql, setSql, handleExecute, isExecuting } = useAbstractionSandbox();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExecute]);

  return (
    <div className="h-full flex flex-col bg-monokai-bg">
      {/* 编辑器头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-monokai-surface border-b border-monokai-border">
        <span className="text-xs text-monokai-fg-muted">SQL 编辑器</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-monokai-fg-muted/60">
            Ctrl+Enter 执行
          </span>
          <button
            onClick={handleExecute}
            disabled={isExecuting || !sandboxSql.trim()}
            className="px-3 py-1 text-xs font-medium rounded-md bg-monokai-green text-white hover:bg-monokai-green/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting ? '执行中...' : '执行'}
          </button>
        </div>
      </div>

      {/* CodeMirror */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={sandboxSql}
          onChange={setSql}
          extensions={[
            sqlLang(),
            EditorView.theme({
              '&': { height: '100%', fontSize: '13px' },
              '.cm-scroller': {
                overflow: 'auto',
                fontFamily: 'JetBrains Mono, Consolas, monospace',
              },
              '.cm-content': { caretColor: '#f8f8f2' },
              '.cm-cursor': { borderLeftColor: '#f8f8f2' },
              '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
                backgroundColor: '#44475a',
              },
            }),
          ]}
          theme="dark"
          placeholder="输入 SQL 语句..."
          className="h-full"
        />
      </div>
    </div>
  );
};

export default SandboxEditor;
