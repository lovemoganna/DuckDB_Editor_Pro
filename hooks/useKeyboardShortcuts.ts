import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  captureInputs?: boolean;
}

/**
 * 全局键盘快捷键Hook
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: 'n', ctrl: true, description: '新建', action: handleNew },
 *     { key: 's', ctrl: true, description: '保存', action: handleSave },
 *     { key: 'z', ctrl: true, description: '撤销', action: handleUndo },
 *     { key: 'z', ctrl: true, shift: true, description: '重做', action: handleRedo },
 *     { key: '?', description: '显示帮助', action: showHelp },
 *   ],
 *   enabled: true,
 * });
 * ```
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  captureInputs = false,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  
  // 更新快捷键引用
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // 如果不捕获输入元素中的按键，只在非输入元素时触发
    if (!captureInputs) {
      const target = event.target as HTMLElement;
      const isInputElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      
      if (isInputElement) return;
    }

    // 查找匹配的快捷键
    for (const shortcut of shortcutsRef.current) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       event.code.toLowerCase() === shortcut.key.toLowerCase();
      
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        return;
      }
    }
  }, [enabled, captureInputs]);

  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    shortcuts,
  };
}

/**
 * 快捷键检测工具函数
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                   event.code.toLowerCase() === shortcut.key.toLowerCase();
  
  const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;

  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

/**
 * 格式化快捷键显示文本
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('⌘');
  if (shortcut.meta) parts.push('⌃');
  if (shortcut.alt) parts.push('⌥');
  if (shortcut.shift) parts.push('⇧');
  
  // 特殊键格式化
  const specialKeys: Record<string, string> = {
    ' ': 'Space',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'enter': '↵',
    'escape': 'Esc',
    'backspace': '⌫',
    'delete': '⌦',
    'tab': '⇥',
    'home': '↖',
    'end': '↘',
    'pageup': '⇞',
    'pagedown': '⇟',
  };
  
  const key = specialKeys[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase();
  parts.push(key);
  
  return parts.join('');
}

/**
 * 常用快捷键预设
 */
export const PRESET_SHORTCUTS = {
  // 全局
  search: { key: 'f', ctrl: true, description: '搜索' },
  save: { key: 's', ctrl: true, description: '保存' },
  undo: { key: 'z', ctrl: true, description: '撤销' },
  redo: { key: 'z', ctrl: true, shift: true, description: '重做' },
  copy: { key: 'c', ctrl: true, description: '复制' },
  paste: { key: 'v', ctrl: true, description: '粘贴' },
  cut: { key: 'x', ctrl: true, description: '剪切' },
  selectAll: { key: 'a', ctrl: true, description: '全选' },
  close: { key: 'Escape', description: '关闭' },
  help: { key: '?', description: '显示帮助' },
  
  // 编辑
  newItem: { key: 'n', ctrl: true, description: '新建' },
  delete: { key: 'Delete', description: '删除' },
  edit: { key: 'Enter', description: '编辑' },
  
  // 导航
  next: { key: 'ArrowDown', description: '下一个' },
  prev: { key: 'ArrowUp', description: '上一个' },
  toggle: { key: 'Tab', description: '切换' },
};

/**
 * 快捷键提示组件配置
 */
export interface ShortcutHint {
  key: string;
  description: string;
}

export const GLOBAL_SHORTCUTS: ShortcutHint[] = [
  { key: '⌘F', description: '搜索' },
  { key: '⌘S', description: '保存' },
  { key: '⌘Z', description: '撤销' },
  { key: '⌘⇧Z', description: '重做' },
  { key: '?', description: '显示帮助' },
  { key: 'Esc', description: '关闭' },
];
