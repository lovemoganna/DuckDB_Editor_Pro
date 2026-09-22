/**
 * ConfirmDialog — 统一确认弹窗组件
 *
 * 替代原生 window.confirm()，与 Monokai 暗色主题一致。
 * 提供 useConfirmDialog hook 以便全局调用。
 *
 * Usage:
 *   const { confirm } = useConfirmDialog();
 *   const ok = await confirm({ title: '确认删除？', message: '...' });
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export type ConfirmInput = ConfirmOptions | string;

export interface ConfirmDialogContextValue {
  confirm: (options: ConfirmInput) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    // Fallback to native confirm if provider not mounted (backward compat)
    return {
      confirm: async (opts) => {
        if (typeof opts === 'string') return window.confirm(opts);
        return window.confirm(opts.message || opts.title || '确认操作？');
      },
    };
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
  }>({
    open: false,
    options: { title: '操作确认' },
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmInput): Promise<boolean> => {
    const normalized: ConfirmOptions = typeof options === 'string'
      ? { title: '操作确认', message: options, variant: 'warning' }
      : { title: options.title || '操作确认', ...options };

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options: normalized });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const { open, options } = state;

  // ESC key to close modal - Critical fix for UX accessibility
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  const variantStyles = {
    danger: {
      iconBg: 'bg-monokai-pink/12',
      iconColor: 'text-monokai-pink',
      confirmBg: 'bg-monokai-pink text-white hover:brightness-110',
    },
    warning: {
      iconBg: 'bg-monokai-yellow/12',
      iconColor: 'text-monokai-yellow',
      confirmBg: 'bg-monokai-yellow text-monokai-bg hover:brightness-110',
    },
    info: {
      iconBg: 'bg-monokai-accent/12',
      iconColor: 'text-monokai-accent',
      confirmBg: 'bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover',
    },
  };
  const variant = options.variant || 'warning';
  const styles = variantStyles[variant];
  const IconComp = variant === 'info' ? Info : AlertTriangle;

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}

      {/* Overlay + Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => handleClose(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/65" />

          {/* Dialog */}
          <div
            className="relative z-10 mx-4 w-full max-w-md rounded-lg border border-monokai-border bg-monokai-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-5 pb-3">
              <div className={`shrink-0 p-2 rounded-lg ${styles.iconBg}`}>
                <IconComp className={`w-5 h-5 ${styles.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-monokai-fg leading-snug">
                  {options.title || '操作确认'}
                </h3>
                {options.message && (
                  <p className="mt-1.5 text-[13px] text-monokai-comment leading-relaxed whitespace-pre-line">
                    {options.message}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 p-4 pt-2">
              <button
                className="px-4 py-1.5 text-[13px] font-medium text-monokai-fg bg-monokai-bg hover:bg-monokai-sidebar border border-monokai-border rounded-lg transition-colors cursor-pointer"
                onClick={() => handleClose(false)}
                autoFocus
              >
                {options.cancelText || '取消'}
              </button>
              <button
                className={`px-4 py-1.5 text-[13px] font-medium text-white rounded-lg transition-colors cursor-pointer ${styles.confirmBg}`}
                onClick={() => handleClose(true)}
              >
                {options.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};
