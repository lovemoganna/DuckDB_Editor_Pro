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
import { ActionButton, ModalShell } from './Workbench';

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
      resolverRef.current?.(false);
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

  useEffect(() => () => { resolverRef.current?.(false); }, []);
  const variant = options.variant || 'warning';
  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ModalShell
        open={open}
        title={options.title || '操作确认'}
        onClose={() => handleClose(false)}
        size="sm"
        icon={variant === 'info' ? Info : AlertTriangle}
        iconColor={variant === 'danger' ? 'text-monokai-pink' : variant === 'warning' ? 'text-monokai-yellow' : 'text-monokai-accent'}
        footer={<>
          <ActionButton autoFocus onClick={() => handleClose(false)}>{options.cancelText || '取消'}</ActionButton>
          <ActionButton variant={variant === 'info' ? 'primary' : variant} onClick={() => handleClose(true)}>{options.confirmText || '确认'}</ActionButton>
        </>}
      >
        {options.message && <p className="whitespace-pre-line break-words text-xs leading-relaxed text-monokai-fg-muted">{options.message}</p>}
      </ModalShell>
    </ConfirmDialogContext.Provider>
  );
};
