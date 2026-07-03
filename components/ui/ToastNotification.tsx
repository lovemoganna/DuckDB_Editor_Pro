/**
 * ToastNotification — 轻量级 Toast 通知组件
 *
 * 提供 success / error / warning / info 四种通知类型，
 * 自动在 3 秒后消失。可作为受控组件或独立挂载。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const toastStyles: Record<ToastType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-monokai-green/15',
    border: 'border-monokai-green/30',
    text: 'text-monokai-green',
    icon: <Check className="w-4 h-4 shrink-0" />,
  },
  error: {
    bg: 'bg-monokai-red/15',
    border: 'border-monokai-red/30',
    text: 'text-monokai-red',
    icon: <X className="w-4 h-4 shrink-0" />,
  },
  warning: {
    bg: 'bg-monokai-yellow/15',
    border: 'border-monokai-yellow/30',
    text: 'text-monokai-yellow',
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
  },
  info: {
    bg: 'bg-monokai-cyan/15',
    border: 'border-monokai-cyan/30',
    text: 'text-monokai-cyan',
    icon: <Info className="w-4 h-4 shrink-0" />,
  },
};

export const ToastNotification: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const style = toastStyles[type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        onClose?.();
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onClose]);

  return (
    <div
      role="alert"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium border animate-[fadeIn_0.2s_ease-out] ${style.bg} ${style.border} ${style.text}`}
    >
      {style.icon}
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="关闭通知"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

// ── Hook-based toast manager (for use outside of render) ────────
export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export function useToastManager() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}

// ── Global Toast Portal ─────────────────────────────────────────
// Renders toasts at document root level, works anywhere in the app
export const ToastPortal: React.FC<{ toasts: ToastItem[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;
  return (
    <>
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </>
  );
};
