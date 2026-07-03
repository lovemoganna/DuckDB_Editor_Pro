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
  color: string;
  severity: 'safe' | 'warning' | 'danger';
}> = [
  {
    level: 'L1',
    label: 'L1 · 清除行动',
    description: '清空所有待执行行动，保留对象和关系',
    tables: ['life_action'],
    color: 'text-monokai-yellow',
    severity: 'safe',
  },
  {
    level: 'L2',
    label: 'L2 · 清除实体',
    description: '清空对象和关系，保留表结构和行动',
    tables: ['life_object', 'life_link'],
    color: 'text-monokai-orange',
    severity: 'warning',
  },
  {
    level: 'L3',
    label: 'L3 · 全部清空',
    description: '清空所有数据（保留表结构），不可恢复',
    tables: ['life_object', 'life_link', 'life_object_type', 'life_link_type', 'life_action', 'life_introspection', 'life_insight', 'life_canvas_state'],
    color: 'text-monokai-red',
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
    safe: 'bg-monokai-green/10 text-monokai-green border-monokai-green/20',
    warning: 'bg-monokai-yellow/10 text-monokai-yellow border-monokai-yellow/20',
    danger: 'bg-monokai-red/10 text-monokai-red border-monokai-red/20',
  };

  const optionColorMap: Record<ClearLevel, { text: string; bg: string; border: string }> = {
    L1: { text: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)' },
    L2: { text: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)' },
    L3: { text: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  };

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setOpen(v => !v); setConfirmLevel(null); }}
          title="快速清除数据"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8,
            fontSize: 11, fontWeight: 600,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          清除
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: '100%', right: 0,
              marginTop: 6, minWidth: 280, zIndex: 9999,
              background: 'rgba(23,23,35,0.98)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              padding: 6,
            }}
          >
            <div className="px-3 py-2 mb-1">
              <span className="text-xs font-semibold text-monokai-comment">快速清除 — 选择级别后再次点击确认</span>
            </div>

            {CLEAR_OPTIONS.map(option => {
              const isConfirming = confirmLevel === option.level;
              const colors = optionColorMap[option.level];

              return (
                <button
                  key={option.level}
                  onClick={() => handleClear(option.level)}
                  disabled={clearing && confirmLevel !== option.level}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    borderRadius: 8, marginBottom: 2,
                    fontSize: 12,
                    background: isConfirming ? `${colors.bg}` : 'transparent',
                    border: `1px solid ${isConfirming ? colors.border : 'transparent'}`,
                    cursor: clearing && confirmLevel !== option.level ? 'not-allowed' : 'pointer',
                    opacity: clearing && confirmLevel !== option.level ? 0.5 : 1,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}
                >
                  {isConfirming && !clearing ? (
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: colors.text }} />
                  ) : (
                    <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityBadge[option.severity]}`}>
                      {option.level}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold" style={{ color: isConfirming && !clearing ? colors.text : '#94a3b8' }}>
                      {isConfirming && !clearing ? '点击确认清除' : option.label.replace(/^L\d · /, '')}
                    </div>
                    <div className="text-[11px] mt-0.5 leading-4" style={{ color: '#64748b' }}>
                      {isConfirming && !clearing ? `即将清空 ${option.tables.join(', ')}` : option.description}
                    </div>
                    {clearing && isConfirming && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px]" style={{ color: '#64748b' }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        清除中...
                      </div>
                    )}
                  </div>
                  {isConfirming && !clearing && (
                    <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#64748b' }} />
                  )}
                </button>
              );
            })}
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
