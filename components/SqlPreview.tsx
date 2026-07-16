/**
 * SQL Preview Component
 *
 * Displays generated SQL with syntax highlighting and execution options.
 * Design: Flat Monokai — no glassmorphism, no shadows, 1px borders.
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { highlightSql } from '../utils.tsx';

// ─── Monokai hex palette ─────────────────────────────────────────────────────
const C = {
  bg:      '#272822',
  surface: '#1e1f1c',
  sidebar: '#3e3d32',
  border:  '#3e3d32',
  fg:      '#f8f8f2',
  muted:   '#75715e',
  green:   '#a6e22e',
  blue:    '#66d9ef',
  amethyst:  '#ae81ff',
  pink:    '#f92672',
  yellow:  '#e6db74',
  orange:  '#fd971f',
  accent:  '#66d9ef',
};

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

  React.useEffect(() => {
    setEditedSql(sql);
  }, [sql]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExecute = () => {
    if (onExecute) onExecute(editedSql);
  };

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
    <div style={{ background: C.sidebar, borderTop: `1px solid ${C.border}` }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.sidebar }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: C.fg }}
          >
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: `${C.amethyst}30` }}
            >
              <FileCode className="w-4 h-4" style={{ color: C.amethyst }} />
            </div>
            <span>SQL 预览</span>
            {isExpanded
              ? <ChevronUp className="w-4 h-4" style={{ color: C.muted }} />
              : <ChevronDown className="w-4 h-4" style={{ color: C.muted }} />
            }
          </button>

          {error && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
              style={{ background: `${C.pink}30`, color: C.pink, border: `1px solid ${C.pink}50` }}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              生成失败
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border transition-colors"
            style={{
              color: isEditing ? C.amethyst : C.muted,
              borderColor: isEditing ? C.amethyst : C.border,
              background: isEditing ? `${C.amethyst}15` : 'transparent',
            }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isEditing ? '取消编辑' : '编辑'}
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border transition-colors"
            style={{
              color: copied ? C.green : C.muted,
              borderColor: copied ? C.green : C.border,
              background: copied ? `${C.green}15` : 'transparent',
            }}
          >
            {copied ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> <span>已复制</span></>
            ) : (
              <><Clipboard className="w-3.5 h-3.5" /> <span>复制</span></>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border transition-colors"
            style={{ color: C.muted, borderColor: C.border }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载</span>
          </button>

          {onExecute && !error && (
            <button
              onClick={handleExecute}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors"
              style={{ background: C.green, color: C.surface, borderColor: C.green }}
            >
              <Play className="w-3.5 h-3.5" />
              <span>执行</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 transition-colors"
              style={{ color: C.muted }}
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
            <div
              className="p-4"
              style={{ background: `${C.pink}15`, border: `1px solid ${C.pink}50` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ background: `${C.pink}30` }}
                >
                  <AlertCircle className="w-4 h-4" style={{ color: C.pink }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.pink }}>执行错误</p>
                  <p className="text-sm mt-1" style={{ color: C.pink }}>{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isEditing ? (
                <textarea
                  value={editedSql}
                  onChange={(e) => setEditedSql(e.target.value)}
                  className="w-full h-48 px-4 py-3 font-mono text-sm resize-none focus:outline-none"
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.fg,
                  }}
                  spellCheck={false}
                />
              ) : (
                <pre
                  className="w-full max-h-48 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap custom-scrollbar"
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.fg,
                  }}
                  dangerouslySetInnerHTML={{ __html: highlightSql(editedSql) }}
                />
              )}

              {explanation && !isEditing && (
                <div
                  className="mt-3 p-3"
                  style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}50` }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                      style={{ background: `${C.blue}30` }}
                    >
                      <FileCode className="w-4 h-4" style={{ color: C.blue }} />
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: C.blue }}>
                      {explanation}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                <span className="flex items-center gap-1.5 px-2.5 py-1" style={{ background: C.sidebar }}>
                  <Clock className="w-3 h-3" />
                  <span>{editedSql.length} 字符</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1" style={{ background: C.sidebar }}>
                  <FileCode className="w-3 h-3" />
                  <span>{editedSql.split('\n').length} 行</span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        /* SQL Syntax Highlighting — Monokai Theme */
        .sql-keyword   { color: #ae81ff !important; font-weight: 600; }
        .sql-function  { color: #66d9ef !important; font-weight: 500; }
        .sql-string    { color: #a6e22e !important; font-style: italic; }
        .sql-number    { color: #fd971f !important; }
        .sql-comment   { color: #75715e !important; font-style: italic; }
      `}</style>
    </div>
  );
};

export default SqlPreview;
