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

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    // Fallback to native confirm if provider not mounted (backward compat)
    return {
      confirm: async (opts) => window.confirm(opts.message || opts.title),
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
    options: { title: '' },
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const { open, options } = state;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      confirmBg: 'bg-red-600 hover:bg-red-500',
    },
    warning: {
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      confirmBg: 'bg-amber-600 hover:bg-amber-500',
    },
    info: {
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      confirmBg: 'bg-blue-600 hover:bg-blue-500',
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog */}
          <div
            className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-[#444] bg-[#1e1f1c] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-5 pb-3">
              <div className={`shrink-0 p-2 rounded-lg ${styles.iconBg}`}>
                <IconComp className={`w-5 h-5 ${styles.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-[#f8f8f2] leading-snug">
                  {options.title}
                </h3>
                {options.message && (
                  <p className="mt-1.5 text-[13px] text-[#a6a6a6] leading-relaxed whitespace-pre-line">
                    {options.message}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 p-4 pt-2">
              <button
                className="px-4 py-1.5 text-[13px] font-medium text-[#ccc] bg-[#333] hover:bg-[#444] rounded-lg transition-colors cursor-pointer"
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
