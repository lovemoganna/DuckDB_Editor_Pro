/**
 * RowDetailPanel - 行记录明细抽屉/弹窗
 * 
 * 展示选定数据行的完整键值明细，支持键名即时搜索过滤、快捷复制与键盘切换上一行/下一行。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Copy, Check, Search, Code, Eye } from 'lucide-react';
import { toastService } from '../services/toastService';

interface RowDetailPanelProps {
  isOpen: boolean;
  expandedRowIdx: number | null;
  tableData: any[];
  onClose: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export const RowDetailPanel: React.FC<RowDetailPanelProps> = ({
  isOpen,
  expandedRowIdx,
  tableData,
  onClose,
  onNavigatePrev,
  onNavigateNext,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedRowMode, setCopiedRowMode] = useState<'json' | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) onNavigatePrev();
      if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) onNavigateNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigatePrev, onNavigateNext]);

  // Reset search when modal closes or opens
  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  if (!isOpen || expandedRowIdx === null) return null;

  const row = tableData[expandedRowIdx];
  const total = tableData.length;
  const isFirst = expandedRowIdx === 0;
  const isLast = expandedRowIdx === total - 1;

  const handleCopyValue = (key: string, val: any) => {
    const text = typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val ?? '');
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toastService.success(`已复制字段 "${key}" 的值`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleCopyRowJson = () => {
    if (!row) return;
    navigator.clipboard.writeText(JSON.stringify(row, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    setCopiedRowMode('json');
    toastService.success('整行数据已复制为 JSON');
    setTimeout(() => setCopiedRowMode(null), 1500);
  };

  const filteredEntries = useMemo(() => {
    if (!row) return [];
    const entries = Object.entries(row);
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter(([key, val]) => {
      const keyMatch = key.toLowerCase().includes(q);
      const valMatch = String(val ?? '').toLowerCase().includes(q);
      return keyMatch || valMatch;
    });
  }, [row, searchQuery]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-monokai-sidebar border border-monokai-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-monokai-border/80 bg-monokai-sidebar/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-monokai-surface text-monokai-fg border border-monokai-border">
              <Eye size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-monokai-fg font-sans tracking-tight flex items-center gap-2">
                行记录明细
                <span className="text-[11px] font-mono font-normal text-monokai-comment">
                  #{expandedRowIdx + 1} / 共 {total} 行
                </span>
              </h2>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-2">
            {/* Quick copy row JSON */}
            <button
              type="button"
              onClick={handleCopyRowJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border text-xs font-mono text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer"
              title="复制整行 JSON"
            >
              {copiedRowMode === 'json' ? <Check size={13} className="text-monokai-green" /> : <Code size={13} />}
              <span>{copiedRowMode === 'json' ? '已复制' : '复制 JSON'}</span>
            </button>

            {/* Prev / Next buttons */}
            <div className="flex items-center rounded-lg bg-monokai-surface border border-monokai-border p-0.5">
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={isFirst}
                className="p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg disabled:opacity-30 transition-colors cursor-pointer"
                title="上一行 (快捷键: ←)"
                aria-label="上一行"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-1.5 text-[11px] font-mono text-monokai-comment select-none">
                {expandedRowIdx + 1}
              </span>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={isLast}
                className="p-1 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg disabled:opacity-30 transition-colors cursor-pointer"
                title="下一行 (快捷键: →)"
                aria-label="下一行"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/15 transition-colors cursor-pointer ml-1"
              title="关闭 (快捷键: Esc)"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-5 py-2.5 bg-monokai-bg/60 border-b border-monokai-border/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-monokai-surface/80 border border-monokai-border/80 px-2.5 py-1 rounded-lg text-xs">
            <Search size={13} className="text-monokai-comment shrink-0" />
            <input
              type="text"
              placeholder="搜索字段名或字段内容..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-monokai-fg placeholder-monokai-comment outline-none font-mono text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-monokai-comment hover:text-monokai-fg cursor-pointer p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-monokai-comment shrink-0 select-none">
            {filteredEntries.length} / {row ? Object.keys(row).length : 0} 字段
          </span>
        </div>

        {/* Key-Value Table Content */}
        <div className="overflow-y-auto flex-1 font-mono text-xs custom-scrollbar p-3 sm:p-5">
          {filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-monokai-comment flex flex-col items-center justify-center gap-2">
              <Search size={28} className="opacity-30" />
              <p className="text-xs font-medium text-monokai-fg">未匹配到任何字段</p>
              <p className="text-[11px] text-monokai-comment">请尝试更换搜索关键字</p>
            </div>
          ) : (
            <div className="divide-y divide-monokai-border/40 rounded-lg border border-monokai-border/70 overflow-hidden bg-monokai-bg/50">
              {filteredEntries.map(([key, val], idx) => {
                const isNull = val === null || val === undefined;
                const isObj = typeof val === 'object' && val !== null;
                const isNum = typeof val === 'number';
                const isBool = typeof val === 'boolean';

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-start p-3 hover:bg-monokai-surface/60 transition-colors group gap-2 sm:gap-4"
                  >
                    {/* Left: Column Name */}
                    <div className="sm:w-1/3 flex items-center justify-between gap-2 shrink-0 select-none pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-monokai-comment font-mono opacity-50 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-monokai-fg truncate" title={key}>
                          {key}
                        </span>
                      </div>
                    </div>

                    {/* Right: Column Value & Copy */}
                    <div className="sm:w-2/3 flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 overflow-x-auto custom-scrollbar">
                        {isNull ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-monokai-surface text-monokai-pink border border-monokai-border">
                            NULL
                          </span>
                        ) : isBool ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              val ? 'bg-monokai-green/15 text-monokai-green' : 'bg-monokai-comment/20 text-monokai-comment'
                            }`}
                          >
                            {val ? 'TRUE' : 'FALSE'}
                          </span>
                        ) : isObj ? (
                          <pre className="text-[11px] text-monokai-fg bg-monokai-surface/80 p-2 rounded-lg border border-monokai-border/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(val, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
                          </pre>
                        ) : isNum ? (
                          <span className="text-monokai-yellow font-mono font-medium tabular-nums">
                            {val}
                          </span>
                        ) : (
                          <span className="text-monokai-fg break-all whitespace-pre-wrap leading-relaxed">
                            {String(val)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyValue(key, val)}
                        className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-all cursor-pointer shrink-0"
                        title={`复制 "${key}" 的值`}
                        aria-label={`复制 ${key} 的值`}
                      >
                        {copiedKey === key ? (
                          <Check size={13} className="text-monokai-green" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-5 py-2.5 bg-monokai-sidebar/95 border-t border-monokai-border/80 flex items-center justify-between text-[11px] text-monokai-comment font-mono shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border text-[10px]">←</kbd>
              <span>上一行</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border text-[10px]">→</kbd>
              <span>下一行</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border text-[10px]">Esc</kbd>
              <span>关闭</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-monokai-surface hover:bg-monokai-surface/80 border border-monokai-border text-xs text-monokai-fg transition-colors cursor-pointer font-sans font-medium"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

export default RowDetailPanel;
