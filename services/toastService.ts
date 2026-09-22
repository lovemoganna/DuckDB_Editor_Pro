/**
 * Global Toast Service — Singleton
 *
 * Allows any module (outside React component tree) to push
 * toast notifications without needing a hook or React context.
 *
 * Usage:
 *   import { toastService } from './toastService';
 *   toastService.show('Done!', 'success', 'All 5 tables exported');
 */

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastEvent {
  id: string;
  message: string;
  severity: ToastSeverity;
  detail?: string;
  duration?: number;
}

type ToastListener = (event: ToastEvent) => void;

class ToastService {
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  show(
    message: string,
    severity: ToastSeverity = 'info',
    detail?: string,
    duration?: number,
  ) {
    const event: ToastEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      severity,
      detail,
      duration,
    };
    this.listeners.forEach(l => l(event));
  }

  success(message: string, detail?: string) {
    this.show(message, 'success', detail);
  }

  error(message: string, detail?: string) {
    this.show(message, 'error', detail);
  }

  warning(message: string, detail?: string) {
    this.show(message, 'warning', detail);
  }

  info(message: string, detail?: string) {
    this.show(message, 'info', detail);
  }
}

export const toastService = new ToastService();
