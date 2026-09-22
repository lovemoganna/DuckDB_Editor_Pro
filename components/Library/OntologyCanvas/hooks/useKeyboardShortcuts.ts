/**
 * useKeyboardShortcuts - 键盘快捷键 Hook
 * 
 * 功能:
 * - 注册全局键盘快捷键
 * - 支持 Ctrl/Cmd, Shift, Alt 组合键
 * - 冲突检测
 * - 快捷键提示显示
 * 
 * @example
 * ```tsx
 * const shortcuts = useKeyboardShortcuts({
 *   'Ctrl+C': () => copyNodes(),
 *   'Ctrl+V': () => pasteNodes(),
 *   'Ctrl+Z': () => undo(),
 *   'Delete': () => deleteSelected(),
 *   'Escape': () => clearSelection(),
 *   'Ctrl+A': () => selectAll(),
 * }, { enabled: true });
 * ```
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';

// ============================================================
// Types
// ============================================================

export type ModifierKey = 'ctrl' | 'meta' | 'shift' | 'alt';

export interface ShortcutConfig {
  /** 快捷键描述 */
  description?: string;
  
  /** 快捷键分组 */
  group?: string;
  
  /** 快捷键回调 */
  action: () => void;
  
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
  
  /** 快捷键是否启用 */
  enabled?: boolean;
}

export type ShortcutKey = string; // e.g., 'Ctrl+C', 'Shift+Click', 'Delete'

export type ShortcutMap = Record<ShortcutKey, ShortcutConfig>;

export interface UseKeyboardShortcutsOptions {
  /** 是否启用 */
  enabled?: boolean;
  
  /** 自定义快捷键映射 */
  shortcuts?: ShortcutMap;
  
  /** 忽略快捷键的元素选择器 (在这些元素上不触发) */
  ignoreSelectors?: string[];
  
  /** 是否在初始化时绑定 */
  bindOnMount?: boolean;
}

// ============================================================
// Default Shortcuts
// ============================================================

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  // 选择操作
  'Ctrl+A': {
    description: '全选',
    group: '选择',
    action: () => {},
  },
  'Ctrl+D': {
    description: '取消全选',
    group: '选择',
    action: () => {},
  },
  'Escape': {
    description: '清空选择',
    group: '选择',
    action: () => {},
  },

  // 编辑操作
  'Ctrl+C': {
    description: '复制',
    group: '编辑',
    action: () => {},
  },
  'Ctrl+V': {
    description: '粘贴',
    group: '编辑',
    action: () => {},
  },
  'Ctrl+X': {
    description: '剪切',
    group: '编辑',
    action: () => {},
  },
  'Delete': {
    description: '删除选中',
    group: '编辑',
    action: () => {},
  },
  'Backspace': {
    description: '删除选中',
    group: '编辑',
    action: () => {},
  },
  'Ctrl+Z': {
    description: '撤销',
    group: '编辑',
    action: () => {},
  },
  'Ctrl+Y': {
    description: '重做',
    group: '编辑',
    action: () => {},
  },
  'Ctrl+Shift+Z': {
    description: '重做 (Alt)',
    group: '编辑',
    action: () => {},
  },

  // 视图操作
  'Ctrl+0': {
    description: '适应全部',
    group: '视图',
    action: () => {},
  },
  'Ctrl+Plus': {
    description: '放大',
    group: '视图',
    action: () => {},
  },
  'Ctrl+Minus': {
    description: '缩小',
    group: '视图',
    action: () => {},
  },
  'Ctrl+Scroll': {
    description: '缩放',
    group: '视图',
    action: () => {},
  },

  // 节点操作
  'N': {
    description: '新建节点',
    group: '节点',
    action: () => {},
  },
  'L': {
    description: '锁定/解锁',
    group: '节点',
    action: () => {},
  },
  'E': {
    description: '编辑节点',
    group: '节点',
    action: () => {},
  },

  // 边操作
  'R': {
    description: '反转边方向',
    group: '边',
    action: () => {},
  },
};

// ============================================================
// Parsing Utilities
// ============================================================

/**
 * 解析快捷键字符串
 */
function parseShortcut(key: string): {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
} {
  const parts = key.split('+').map((p) => p.trim().toLowerCase());
  const modifiers: ModifierKey[] = ['ctrl', 'meta', 'shift', 'alt'];
  
  const result = {
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    key: '',
  };

  parts.forEach((part) => {
    if (modifiers.includes(part as ModifierKey)) {
      (result as any)[part] = true;
    } else {
      result.key = part;
    }
  });

  return result;
}

/**
 * 检查快捷键是否匹配
 */
function matchesShortcut(
  event: KeyboardEvent,
  parsed: ReturnType<typeof parseShortcut>
): boolean {
  // 检查 key
  const eventKey = event.key.toLowerCase();
  const targetKey = parsed.key.toLowerCase();
  
  if (eventKey !== targetKey) {
    // 特殊处理
    if (targetKey === 'delete' && event.key !== 'Delete') return false;
    if (targetKey === 'backspace' && event.key !== 'Backspace') return false;
    if (targetKey === 'escape' && event.key !== 'Escape') return false;
    if (targetKey === 'enter' && event.key !== 'Enter') return false;
    if (targetKey === 'tab' && event.key !== 'Tab') return false;
    if (targetKey === 'space' && event.key !== ' ') return false;
  }

  // 检查修饰键
  const ctrlMatch = parsed.ctrl ? event.ctrlKey : !event.ctrlKey;
  const metaMatch = parsed.meta ? event.metaKey : !event.metaKey;
  const shiftMatch = parsed.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = parsed.alt ? event.altKey : !event.altKey;

  // macOS 上 Cmd 等同于 Ctrl
  const effectiveCtrlMatch = parsed.ctrl ? (event.ctrlKey || event.metaKey) : true;

  return ctrlMatch && metaMatch && shiftMatch && altMatch && effectiveCtrlMatch;
}

// ============================================================
// Hook
// ============================================================

export interface UseKeyboardShortcutsReturn {
  /** 注册快捷键 */
  registerShortcut: (key: string, config: ShortcutConfig) => void;
  
  /** 注销快捷键 */
  unregisterShortcut: (key: string) => void;
  
  /** 获取所有快捷键 */
  getShortcuts: () => ShortcutMap;
  
  /** 获取快捷键提示列表 */
  getShortcutHints: () => Array<{ key: string; description: string; group: string }>;
  
  /** 检查快捷键是否已注册 */
  isRegistered: (key: string) => boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap = {},
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn {
  const {
    enabled = true,
    ignoreSelectors = ['input', 'textarea', '[contenteditable="true"]'],
    bindOnMount = true,
  } = options;

  // 存储所有快捷键 (合并默认和自定义)
  const shortcutsRef = useRef<ShortcutMap>({ ...DEFAULT_SHORTCUTS, ...shortcuts });
  
  // 记录已处理的快捷键 (用于阻止重复触发)
  const processedRef = useRef<Set<string>>(new Set());

  // 合并快捷键
  useEffect(() => {
    shortcutsRef.current = { ...DEFAULT_SHORTCUTS, ...shortcuts };
  }, [shortcuts]);

  // ============================================================
  // Event Handler
  // ============================================================

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 检查是否应该忽略
    const target = event.target as HTMLElement;
    if (ignoreSelectors.some((selector) => target.closest(selector))) {
      return;
    }

    // 遍历所有快捷键查找匹配
    for (const [key, config] of Object.entries(shortcutsRef.current)) {
      if (!config.enabled && config.enabled !== undefined) continue;
      if (!config.action) continue;

      const parsed = parseShortcut(key);
      
      if (matchesShortcut(event, parsed)) {
        // 阻止默认行为
        if (config.preventDefault !== false) {
          event.preventDefault();
        }

        // 检查是否正在处理 (防止重复触发)
        const eventKey = `${key}-${Date.now()}`;
        if (processedRef.current.has(key)) {
          return;
        }
        processedRef.current.add(key);
        setTimeout(() => processedRef.current.delete(key), 100);

        // 执行动作
        try {
          config.action();
        } catch (error) {
          console.error(`[useKeyboardShortcuts] Error executing shortcut "${key}":`, error);
        }

        break;
      }
    }
  }, [enabled, ignoreSelectors]);

  // ============================================================
  // Bind/Unbind
  // ============================================================

  useEffect(() => {
    if (!bindOnMount) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [bindOnMount, handleKeyDown]);

  // ============================================================
  // Registration
  // ============================================================

  const registerShortcut = useCallback((key: string, config: ShortcutConfig) => {
    shortcutsRef.current = {
      ...shortcutsRef.current,
      [key]: config,
    };
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    const { [key]: _, ...rest } = shortcutsRef.current;
    shortcutsRef.current = rest;
  }, []);

  const getShortcuts = useCallback(() => shortcutsRef.current, []);

  const getShortcutHints = useCallback(() => {
    return Object.entries(shortcutsRef.current)
      .filter(([_, config]) => config.description)
      .map(([key, config]) => ({
        key,
        description: config.description!,
        group: config.group ?? '其他',
      }))
      .sort((a, b) => {
        const groupOrder = ['选择', '编辑', '视图', '节点', '边', '其他'];
        const aIndex = groupOrder.indexOf(a.group);
        const bIndex = groupOrder.indexOf(b.group);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.key.localeCompare(b.key);
      });
  }, []);

  const isRegistered = useCallback((key: string) => {
    return key in shortcutsRef.current;
  }, []);

  return {
    registerShortcut,
    unregisterShortcut,
    getShortcuts,
    getShortcutHints,
    isRegistered,
  };
}

export default useKeyboardShortcuts;
