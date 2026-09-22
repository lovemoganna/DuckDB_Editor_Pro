/**
 * OntologyCanvas Hooks - 统一导出
 * 
 * 本模块提供画布交互的核心 Hooks:
 * - useSelection: 节点/边选择管理
 * - useClipboard: 复制/剪切/粘贴
 * - useHistory: 撤销/重做历史
 * - useKeyboardShortcuts: 键盘快捷键
 * - useLayoutPresets: 布局预设管理
 * - useCanvasSnapshot: 快照管理
 */

export { useSelection } from './useSelection';
export type { SelectionState, SelectionAction, UseSelectionReturn } from './useSelection';

export { useClipboard } from './useClipboard';
export type { ClipboardData, UseClipboardReturn } from './useClipboard';

export { useHistory } from './useHistory';
export type { HistoryEntry, UseHistoryReturn } from './useHistory';

export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export type { ShortcutConfig, UseKeyboardShortcutsOptions } from './useKeyboardShortcuts';

export { useLayoutPresets } from './useLayoutPresets';
export type { LayoutPreset, UseLayoutPresetsReturn } from './useLayoutPresets';

export { useCanvasSnapshot } from './useCanvasSnapshot';
export type { CanvasSnapshot, UseCanvasSnapshotReturn } from './useCanvasSnapshot';
