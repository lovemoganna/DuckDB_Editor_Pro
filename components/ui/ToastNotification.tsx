/**
 * ToastNotification — 轻量级 Toast 通知组件 (v2)
 *
 * 改进：
 * - 支持多条 Toast 垂直堆叠（不再互相覆盖）
 * - 每条 Toast 含底部倒计时进度条
 * - success=3s / info=3s / warning=5s / error=6s 自动消失
 * - 支持 title + detail 双行文案
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';
import { toastService } from '../../services/toastService';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  detail?: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  item: ToastItem;
  onClose: (id: string) => void;
}

const TOAST_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 6000,
};

const TOAST_STYLES: Record<ToastType, {
  bg: string;
  border: string;
  iconBg: string;
  icon: React.ReactNode;
  progress: string;
}> = {
  success: {
    bg: 'bg-monokai-sidebar/95',
    border: 'border-monokai-accent/40',
    iconBg: 'bg-monokai-accent/15 text-monokai-accent',
    icon: <Check className="w-4 h-4" />,
    progress: 'bg-monokai-accent',
  },
  error: {
    bg: 'bg-monokai-sidebar/95',
    border: 'border-monokai-pink/40',
    iconBg: 'bg-monokai-pink/15 text-monokai-pink',
    icon: <AlertCircle className="w-4 h-4" />,
    progress: 'bg-monokai-pink',
  },
  warning: {
    bg: 'bg-monokai-sidebar/95',
    border: 'border-monokai-yellow/40',
    iconBg: 'bg-monokai-yellow/15 text-monokai-yellow',
    icon: <AlertTriangle className="w-4 h-4" />,
    progress: 'bg-monokai-yellow',
  },
  info: {
    bg: 'bg-monokai-sidebar/95',
    border: 'border-monokai-cyan/40',
    iconBg: 'bg-monokai-cyan/15 text-monokai-cyan',
    icon: <Info className="w-4 h-4" />,
    progress: 'bg-monokai-cyan',
  },
};

const SingleToast: React.FC<ToastProps> = ({ item, onClose }) => {
  const styles = TOAST_STYLES[item.type];
  const duration = item.duration ?? TOAST_DURATIONS[item.type];
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);

  const remainingTimeRef = useRef(duration);
  const lastTickRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    timerRef.current = setTimeout(() => onClose(item.id), remainingTimeRef.current);

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - delta);
      setProgress((remainingTimeRef.current / duration) * 100);
    }, 50);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(interval);
    };
  }, [isHovered, item.id, duration, onClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl backdrop-blur-md overflow-hidden w-[340px] max-w-[calc(100vw-32px)] transition-all duration-200 ${
        isHovered ? 'scale-[1.02] border-opacity-80 shadow-black/50' : ''
      } ${styles.bg} ${styles.border}`}
    >
      {/* Icon */}
      <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${styles.iconBg}`}>
        {styles.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-[13px] font-semibold text-monokai-fg leading-snug">{item.message}</p>
        {item.detail && (
          <p className="text-[11px] text-monokai-comment mt-0.5 leading-relaxed font-mono select-text">{item.detail}</p>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={() => onClose(item.id)}
        aria-label="关闭通知"
        className="shrink-0 p-0.5 rounded text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-surface transition-colors mt-0.5 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress Bar */}
      <div
        className={`absolute bottom-0 left-0 h-[2.5px] transition-all duration-75 ${styles.progress}`}
        style={{ width: `${progress}%`, opacity: isHovered ? 1 : 0.6 }}
      />
    </div>
  );
};

// ── Hook-based toast manager ────────────────────────────────────

export function useToastManager() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Subscribe to global toastService
    const unsubscribe = toastService.subscribe((event) => {
      setToasts((prev) => [
        ...prev,
        {
          id: event.id,
          message: event.message,
          type: event.severity,
          detail: event.detail,
          duration: event.duration,
        },
      ]);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const addToast = (
    message: string,
    type: ToastType = 'info',
    detail?: string,
    duration?: number,
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, message, type, detail, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  return { toasts, addToast, removeToast, clearAllToasts };
}

// ── Stacked Toast Portal ────────────────────────────────────────

export const ToastPortal: React.FC<{
  toasts: ToastItem[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
}> = ({ toasts, onRemove, onClearAll }) => {
  if (toasts.length === 0) return null;
  const visibleToasts = toasts.slice(-4);

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none items-end"
      aria-label="通知列表"
    >
      {toasts.length >= 3 && (
        <button
          onClick={onClearAll}
          className="pointer-events-auto text-[10px] font-bold text-monokai-comment hover:text-monokai-fg bg-monokai-sidebar/90 border border-monokai-border px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
        >
          清空全部 ({toasts.length})
        </button>
      )}
      {visibleToasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <SingleToast item={toast} onClose={onRemove} />
        </div>
      ))}
    </div>
  );
};

// ── Legacy single-toast compat export ──────────────────────────
export const ToastNotification: React.FC<{
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}> = ({ message, type = 'info', duration, onClose }) => {
  const item: ToastItem = { id: 'single', message, type, duration };
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
      <SingleToast item={item} onClose={() => onClose?.()} />
    </div>
  );
};
