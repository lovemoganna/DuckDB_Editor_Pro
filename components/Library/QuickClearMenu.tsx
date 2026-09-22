/**
 * QuickClearMenu — 快速清除本体数据菜单
 *
 * 三级清除级别：
 * - L1: 清除所有行动（life_action）
 * - L2: 清除对象和关系（life_object, life_link）
 * - L3: 全部清空（保留表结构）
 */

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ToastNotification } from '../ui/ToastNotification';

type ClearLevel = 'L1' | 'L2' | 'L3';

const CLEAR_OPTIONS: Array<{
  level: ClearLevel;
  label: string;
  description: string;
  tables: string[];
  color?: string;
  severity: 'safe' | 'warning' | 'danger';
}> = [
  {
    level: 'L1',
    label: 'L1 · 清除行动',
    description: '清空所有待执行行动，保留对象和关系',
    tables: ['life_action'],
    severity: 'safe',
  },
  {
    level: 'L2',
    label: 'L2 · 清除实体',
    description: '清空对象和关系，保留表结构和行动',
    tables: ['life_object', 'life_link'],
    severity: 'warning',
  },
  {
    level: 'L3',
    label: 'L3 · 全部清空',
    description: '清空所有数据（保留表结构），不可恢复',
    tables: ['life_object', 'life_link', 'life_object_type', 'life_link_type', 'life_action', 'life_introspection', 'life_insight', 'life_canvas_state'],
    severity: 'danger',
  },
];

interface QuickClearMenuProps {
  onClear?: () => void;
}

export const QuickClearMenu: React.FC<QuickClearMenuProps> = ({ onClear }) => {
  const [open, setOpen] = useState(false);
  const [confirmLevel, setConfirmLevel] = useState<ClearLevel | null>(null);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmLevel(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClear = async (level: ClearLevel) => {
    if (confirmLevel !== level) {
      setConfirmLevel(level);
      return;
    }

    setClearing(true);
    try {
      const option = CLEAR_OPTIONS.find(o => o.level === level)!;
      for (const table of option.tables) {
        await duckDBService.query(`DELETE FROM ${table}`);
      }
      setToast({ message: `${option.label} 完成`, type: 'success' });
      setOpen(false);
      setConfirmLevel(null);
      onClear?.();
    } catch (e: any) {
      setToast({ message: `清除失败: ${e.message}`, type: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const severityBadge: Record<string, string> = {
    safe: 'bg-monokai-surface text-monokai-green border-monokai-border-subtle',
    warning: 'bg-monokai-surface text-monokai-yellow border-monokai-border-subtle',
    danger: 'bg-monokai-surface text-rose-400 border-monokai-border-subtle',
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setConfirmLevel(null); }}
          title="快速清除数据"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-monokai-comment hover:text-rose-400 bg-monokai-surface hover:bg-rose-500/10 border border-monokai-border hover:border-rose-500/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent/50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>清除数据</span>
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-1.5 w-76 z-50 bg-monokai-surface border border-monokai-border rounded-xl shadow-2xl p-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-monokai-border/40 mb-1">
              <span className="text-[11px] font-semibold text-monokai-comment">快速清除（点击两下确认）</span>
            </div>

            <div className="space-y-1">
              {CLEAR_OPTIONS.map(option => {
                const isConfirming = confirmLevel === option.level;

                return (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() => handleClear(option.level)}
                    disabled={clearing && confirmLevel !== option.level}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isConfirming
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                        : 'hover:bg-monokai-hover border border-transparent text-monokai-fg'
                    }`}
                  >
                    {isConfirming && !clearing ? (
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                    ) : (
                      <span className={`mt-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${severityBadge[option.severity]}`}>
                        {option.level}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight">
                        {isConfirming && !clearing ? '再次点击确认清除' : option.label.replace(/^L\d · /, '')}
                      </div>
                      <div className="text-[11px] text-monokai-comment mt-1 leading-normal">
                        {isConfirming && !clearing ? `即将清空 ${option.tables.join(', ')}` : option.description}
                      </div>
                      {clearing && isConfirming && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-monokai-comment">
                          <Loader2 className="w-3 h-3 animate-spin text-monokai-accent" />
                          <span>清除中...</span>
                        </div>
                      )}
                    </div>
                    {isConfirming && !clearing && (
                      <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};
