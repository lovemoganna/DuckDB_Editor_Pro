import React, { useState, useEffect, useRef } from 'react';
import { QueryHistoryItem } from '../../types';
import { X, Copy, Play, Check, Star, Trash2, Zap, Code2, AlertTriangle, FileCode2 } from 'lucide-react';
import { highlightSql } from '../../utils';
import { format } from 'sql-formatter';
import { CodeHighlightBlock } from '../ui/CodeHighlightBlock';

interface HistoryDetailDrawerProps {
  item: QueryHistoryItem | null;
  onClose: () => void;
  onCopy: (sql: string, id: string) => void;
  onLoadAndRun: (sql: string) => void;
  onLoadOnly?: (sql: string) => void;
  onToggleStar: (id: string) => void;
  onDelete: (id: string) => void;
}

function fmtMs(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 1) return '<1ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(3)}s`;
  return `${Math.round(ms)}ms`;
}

export const HistoryDetailDrawer: React.FC<HistoryDetailDrawerProps> = ({
  item,
  onClose,
  onCopy,
  onLoadAndRun,
  onLoadOnly,
  onToggleStar,
  onDelete,
}) => {
  const [isFormatted, setIsFormatted] = useState(true);
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!item) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      if (focusable.length === 0) {
        e.preventDefault();
        drawerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [item]);

  if (!item) return null;

  const isSuccess = item.status === 'success';
  const isSlow = (item.executionTime || 0) >= 1000;

  // Format SQL safely
  let displayedSql = item.sql;
  if (isFormatted) {
    try {
      displayedSql = format(item.sql, {
        language: 'duckdb',
        tabWidth: 2,
        keywordCase: 'upper',
      });
    } catch {
      try {
        displayedSql = format(item.sql, {
          language: 'sql',
          tabWidth: 2,
          keywordCase: 'upper',
        });
      } catch {
        displayedSql = item.sql;
      }
    }
  }

  const handleCopyClick = () => {
    onCopy(displayedSql, item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
        <aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="SQL 执行深度分析" tabIndex={-1} className="w-screen max-w-2xl bg-monokai-sidebar border-l border-monokai-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-monokai-border bg-monokai-surface shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-monokai-sidebar text-monokai-fg flex items-center justify-center border border-monokai-border">
                <Code2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-monokai-fg flex items-center gap-2">
                  <span>SQL 执行深度分析</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-medium border border-monokai-border bg-monokai-bg ${
                      isSuccess
                        ? 'text-monokai-green'
                        : 'text-monokai-pink'
                    }`}
                  >
                    {isSuccess ? 'SUCCESS' : 'ERROR'}
                  </span>
                </h3>
                <p className="text-[11px] text-monokai-comment font-mono">ID: {item.id}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Star */}
              <button
                type="button"
                onClick={() => onToggleStar(item.id)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  item.isStarred
                    ? 'text-monokai-yellow hover:bg-monokai-hover'
                    : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-hover'
                }`}
                title={item.isStarred ? '取消收藏' : '收藏此查询'}
              >
                <Star size={16} className={item.isStarred ? 'fill-monokai-yellow' : ''} />
              </button>

              {/* Close */}
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="关闭详情抽屉"
                onClick={onClose}
                className="p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover transition-colors cursor-pointer"
                title="关闭抽屉 (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar bg-monokai-bg">
            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Latency */}
              <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5">
                <div className="text-[10px] text-monokai-comment font-medium">执行耗时</div>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 flex items-center gap-1 ${
                    isSlow ? 'text-monokai-pink' : 'text-monokai-comment'
                  }`}
                >
                  <Zap size={12} className={isSlow ? 'text-monokai-pink' : 'text-monokai-comment'} />
                  <span>{fmtMs(item.executionTime ?? 0)}</span>
                </div>
              </div>

              {/* Timestamp */}
              <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5">
                <div className="text-[10px] text-monokai-comment font-medium">执行时间</div>
                <div className="text-xs font-semibold font-mono text-monokai-fg mt-0.5 truncate">
                  {new Date(item.timestamp).toLocaleTimeString('zh-CN')}
                </div>
              </div>

              {/* Date */}
              <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5">
                <div className="text-[10px] text-monokai-comment font-medium">执行日期</div>
                <div className="text-xs font-semibold font-mono text-monokai-fg mt-0.5 truncate">
                  {new Date(item.timestamp).toLocaleDateString('zh-CN')}
                </div>
              </div>

              {/* Affected Rows */}
              <div className="rounded-md border border-monokai-border bg-monokai-surface p-2.5">
                <div className="text-[10px] text-monokai-comment font-medium">影响行数</div>
                <div className="text-xs font-semibold font-mono text-monokai-fg mt-0.5">
                  {item.affectedRows !== undefined ? `${item.affectedRows} 行` : '—'}
                </div>
              </div>
            </div>

            {/* Error Diagnostics Box if errored */}
            {!isSuccess && item.error && (
              <div className="rounded-md border border-monokai-border bg-monokai-surface p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-pink">
                  <AlertTriangle size={14} />
                  <span>执行异常报错诊断 (Error Diagnostics)</span>
                </div>
                <div className="font-mono text-xs text-monokai-pink bg-monokai-bg rounded-md p-2.5 border border-monokai-border break-all select-text">
                  {item.error}
                </div>
              </div>
            )}

            {/* SQL Code Box */}
            <CodeHighlightBlock
              code={item.sql}
              language="sql"
              title="SQL 查询语句"
              allowFormat={true}
              initialFormat={true}
              maxHeight="360px"
              onCopy={() => onCopy(item.sql, item.id)}
            />
          </div>

          {/* Footer Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-monokai-border bg-monokai-surface shrink-0">
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs text-monokai-pink hover:bg-monokai-hover border border-transparent hover:border-monokai-border transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>删除记录</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyClick}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs text-monokai-fg bg-monokai-surface hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer font-medium shadow-xs"
              >
                {copied ? <Check size={13} className="text-monokai-green" /> : <Copy size={13} />}
                <span>{copied ? '已复制 SQL' : '复制 SQL'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onLoadOnly) onLoadOnly(item.sql);
                  else onLoadAndRun(item.sql);
                  onClose();
                }}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs text-monokai-fg bg-monokai-surface hover:bg-monokai-hover border border-monokai-border transition-colors cursor-pointer font-medium shadow-xs"
                title="载入 SQL 编辑器但暂不执行"
              >
                <Code2 size={13} className="text-monokai-comment" />
                <span>载入编辑器</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onLoadAndRun(item.sql);
                  onClose();
                }}
                className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-md text-xs font-medium text-monokai-bg bg-monokai-green hover:brightness-105 shadow-xs transition-colors cursor-pointer"
                title="载入 SQL 编辑器并立即执行"
              >
                <Play size={13} className="fill-monokai-bg" />
                <span>载入并运行</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
