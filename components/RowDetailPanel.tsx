/**
 * RowDetailPanel - 行记录明细抽屉/弹窗
 *
 * 展示选定数据行的完整键值明细，支持键名即时搜索过滤、快捷复制与键盘切换上一行/下一行。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, Search, Code, Eye } from 'lucide-react';
import { toastService } from '../services/toastService';
import { ModalShell, ActionButton, SearchInput, IconButton, Badge } from './ui/Workbench';

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

  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  const row = expandedRowIdx !== null ? tableData[expandedRowIdx] : null;
  const total = tableData.length;
  const isFirst = expandedRowIdx === 0;
  const isLast = expandedRowIdx !== null && expandedRowIdx === total - 1;

  const handleCopyValue = (key: string, val: any) => {
    const text = typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val ?? '');
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toastService.success(`已复制字段 "${key}" 的值`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleCopyRowJson = () => {
    if (!row) return;
    navigator.clipboard.writeText(JSON.stringify(row, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
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
    <ModalShell
      open={isOpen && expandedRowIdx !== null}
      onClose={onClose}
      title="行记录明细"
      description={expandedRowIdx !== null ? `#${expandedRowIdx + 1} / 共 ${total} 行` : undefined}
      icon={Eye}
      iconColor="text-monokai-cyan"
      size="lg"
      badge={row ? `${filteredEntries.length}/${Object.keys(row).length} 字段` : undefined}
      headerActions={
        <div className="flex items-center gap-1.5">
          <ActionButton
            variant="secondary"
            size="sm"
            icon={copiedRowMode === 'json' ? Check : Code}
            onClick={handleCopyRowJson}
            title="复制整行 JSON"
          >
            {copiedRowMode === 'json' ? '已复制' : '复制 JSON'}
          </ActionButton>
          <div className="flex items-center rounded-lg bg-monokai-surface border border-monokai-border p-0.5">
            <IconButton
              label="上一行"
              icon={ChevronLeft}
              size="sm"
              onClick={onNavigatePrev}
              disabled={isFirst}
              className="!h-7 !w-7"
            />
            <span className="px-1.5 text-meta font-mono text-monokai-comment select-none tabular-nums">
              {(expandedRowIdx ?? 0) + 1}
            </span>
            <IconButton
              label="下一行"
              icon={ChevronRight}
              size="sm"
              onClick={onNavigateNext}
              disabled={isLast}
              className="!h-7 !w-7"
            />
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-3 text-meta text-monokai-comment font-mono">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border text-2xs">←</kbd>
              上一行
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border text-2xs">→</kbd>
              下一行
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-monokai-surface rounded border border-monokai-border text-2xs">Esc</kbd>
              关闭
            </span>
          </div>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            完成
          </ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3 min-h-0">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="搜索字段名或字段内容..."
          size="sm"
          className="w-full max-w-none"
        />

        <div className="overflow-y-auto max-h-[52vh] font-mono text-xs custom-scrollbar">
          {filteredEntries.length === 0 ? (
            <div className="py-10 text-center text-monokai-comment flex flex-col items-center justify-center gap-2">
              <Search size={24} className="opacity-30" />
              <p className="text-xs font-medium text-monokai-fg">未匹配到任何字段</p>
              <p className="text-meta text-monokai-comment">请尝试更换搜索关键字</p>
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
                    className="flex flex-col sm:flex-row sm:items-start p-2.5 hover:bg-monokai-surface/60 transition-colors group gap-2 sm:gap-4"
                  >
                    <div className="sm:w-1/3 flex items-center justify-between gap-2 shrink-0 select-none pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-2xs text-monokai-comment font-mono opacity-50 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-monokai-fg truncate text-xs" title={key}>
                          {key}
                        </span>
                      </div>
                    </div>

                    <div className="sm:w-2/3 flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 overflow-x-auto custom-scrollbar">
                        {isNull ? (
                          <Badge tone="pink" size="sm">NULL</Badge>
                        ) : isBool ? (
                          <Badge tone={val ? 'green' : 'neutral'} size="sm">
                            {val ? 'TRUE' : 'FALSE'}
                          </Badge>
                        ) : isObj ? (
                          <pre className="text-meta text-monokai-fg bg-monokai-surface/80 p-2 rounded-lg border border-monokai-border/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(val, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
                          </pre>
                        ) : isNum ? (
                          <span className="text-monokai-yellow font-mono font-medium tabular-nums">{val}</span>
                        ) : (
                          <span className="text-monokai-fg break-all whitespace-pre-wrap leading-relaxed">{String(val)}</span>
                        )}
                      </div>

                      <IconButton
                        label={`复制 ${key} 的值`}
                        icon={copiedKey === key ? Check : Copy}
                        size="sm"
                        tone={copiedKey === key ? 'success' : 'neutral'}
                        onClick={() => handleCopyValue(key, val)}
                        className="!h-7 !w-7 opacity-60 group-hover:opacity-100"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default RowDetailPanel;
