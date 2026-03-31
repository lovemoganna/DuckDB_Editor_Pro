/**
 * SQL Preview Component
 *
 * Displays generated SQL with syntax highlighting and execution options.
 * Design follows Monokai theme from DESIGN_SYSTEM.md
 * Features:
 * - Enhanced SQL syntax highlighting
 * - Complex query handling
 * - Line-by-line analysis
 * - Error context display
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Play,
  Download,
  X,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileCode,
  CheckCircle2,
  Clipboard,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { highlightSql } from '../utils.tsx';

interface SqlPreviewProps {
  sql: string;
  explanation?: string;
  error?: string;
  onExecute?: (sql: string) => void;
  onClose?: () => void;
}

export const SqlPreview: React.FC<SqlPreviewProps> = ({
  sql,
  explanation,
  error,
  onExecute,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(sql);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync edited SQL with prop
  React.useEffect(() => {
    setEditedSql(sql);
  }, [sql]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Execute SQL
  const handleExecute = () => {
    if (onExecute) {
      onExecute(editedSql);
    }
  };

  // Download SQL
  const handleDownload = () => {
    const blob = new Blob([editedSql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-monokai-sidebar border-t border-monokai-accent">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-monokai-accent bg-monokai-sidebar">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-monokai-fg hover:text-monokai-purple transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-monokai-purple/20 flex items-center justify-center">
              <FileCode className="w-4 h-4 text-monokai-purple" />
            </div>
            <span className="text-monokai-fg">SQL 预览</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-monokai-comment" />
            ) : (
              <ChevronDown className="w-4 h-4 text-monokai-comment" />
            )}
          </button>

          {error && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-monokai-pink/20 text-monokai-pink text-xs font-medium rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              生成失败
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${isEditing
                ? 'bg-monokai-purple/20 text-monokai-purple'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent'
              }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isEditing ? '取消编辑' : '编辑'}
          </button>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${copied
                ? 'bg-monokai-green/20 text-monokai-green'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent'
              }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Clipboard className="w-3.5 h-3.5" />
                <span>复制</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-all duration-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载</span>
          </button>

          {onExecute && !error && (
            <button
              onClick={handleExecute}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-green hover:opacity-90 text-monokai-bg text-xs font-semibold rounded-lg transition-all duration-200"
            >
              <Play className="w-3.5 h-3.5" />
              <span>执行</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent rounded-lg transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SQL Content */}
      {isExpanded && (
        <div className="p-3">
          {error ? (
            <div className="p-4 bg-monokai-pink/20 border border-monokai-pink/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-monokai-pink/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-monokai-pink" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-monokai-pink">
                    执行错误
                  </p>
                  <p className="text-sm text-monokai-pink mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isEditing ? (
                <textarea
                  value={editedSql}
                  onChange={(e) => setEditedSql(e.target.value)}
                  className="w-full h-48 px-4 py-3 font-mono text-sm bg-monokai-bg border border-monokai-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent transition-all text-monokai-fg"
                  spellCheck={false}
                />
              ) : (
                <pre
                  className="w-full h-auto max-h-48 overflow-auto p-4 font-mono text-sm bg-monokai-bg border border-monokai-accent rounded-lg whitespace-pre-wrap custom-scrollbar text-monokai-fg"
                  dangerouslySetInnerHTML={{ __html: highlightSql(editedSql) }}
                />
              )}

              {explanation && !isEditing && (
                <div className="mt-3 p-3 bg-monokai-blue/20 border border-monokai-blue/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-monokai-blue/20 flex items-center justify-center flex-shrink-0">
                      <FileCode className="w-4 h-4 text-monokai-blue" />
                    </div>
                    <p className="text-sm text-monokai-blue leading-relaxed">
                      {explanation}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-monokai-comment">
                <span className="flex items-center gap-1.5 bg-monokai-sidebar px-2.5 py-1 rounded">
                  <Clock className="w-3 h-3" />
                  <span>{editedSql.length} 字符</span>
                </span>
                <span className="flex items-center gap-1.5 bg-monokai-sidebar px-2.5 py-1 rounded">
                  <FileCode className="w-3 h-3" />
                  <span>{editedSql.split('\n').length} 行</span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        /* SQL Syntax Highlighting - Monokai Theme (for backward compatibility) */
        .sql-keyword { color: #ae81ff !important; font-weight: 600; }
        .sql-function { color: #66d9ef !important; font-weight: 500; }
        .sql-string { color: #a6e22e !important; font-style: italic; }
        .sql-number { color: #fd971f !important; }
        .sql-comment { color: #75715e !important; font-style: italic; }
      `}</style>
    </div>
  );
};

export default SqlPreview;
