/**
 * OntologyCanvas 模块导出
 * 
 * MECE组织原则 (v2.0 优化版):
 * - 核心组件：OntologyNode, OntologyEdge, OntologyLinkGroup
 * - 工具栏组件：UnifiedCanvasToolbar (统一工具栏，整合所有功能)
 * - 上下文菜单：CanvasContextMenu
 * - 布局算法：OntologyLayout, OntologyRouting
 * - 辅助功能：OntologyExport, OntologyCteCompiler, helpers
 * - 批量工作台：BatchWorkbench (统一批量操作)
 * - 高级组件：EdgePropertyDialog, HistoryPanel, MeceLayerPanel
 * - 搜索增强：SearchEnhancement
 * - Hooks：选择、历史、剪贴板、布局预设、键盘快捷键等
 * 
 * 删除的冗余组件 (v2.0):
 * - OntologyCanvasHeader.tsx -> 功能被 UnifiedCanvasToolbar 整合
 * - CanvasToolbar.tsx -> 功能被 UnifiedCanvasToolbar 整合
 * - BatchOperationsPanel.tsx -> 功能被 BatchWorkbench 整合
 * - BatchPropertiesPanel.tsx -> 功能被 BatchWorkbench 整合
 * - OntologyNodeCard.tsx -> 未使用
 */

// ============================================================
// 核心组件
// ============================================================
export { OntologyNode } from './OntologyNode';
export { OntologyEdge } from './OntologyEdge';
export { OntologyLinkGroup } from './OntologyLinkGroup';

// ============================================================
// 工具栏组件 (统一版本)
// ============================================================
export { UnifiedCanvasToolbar } from './UnifiedCanvasToolbar';
export type { UnifiedCanvasToolbarProps } from './UnifiedCanvasToolbar';

// ============================================================
// 上下文菜单
// ============================================================
export { CanvasContextMenu } from './CanvasContextMenu';
export type { 
  ContextMenuState, 
  ContextMenuType,
  CanvasContextMenuProps 
} from './CanvasContextMenu';

// ============================================================
// 布局与路由
// ============================================================
export {
  getLayoutedElements,
  applyIncrementalLocalLayout,
  ONTOLOGY_LAYOUTS,
  getOntologyNodeDimensions,
  canvasPositionsNeedRelayout,
  ensureCanvasLayoutPositions,
  applyCanvasLayoutPositions,
} from './OntologyLayout';
export type { OntologyLayoutMode, CanvasPositionMap, EnsureCanvasLayoutInput } from './OntologyLayout';
export * from './OntologyRouting';

// ============================================================
// 导出与编译
// ============================================================
export { downloadOntologyGraph, buildOntologyExportSvg } from './OntologyExport';
export * from './OntologyCteCompiler';

// ============================================================
// 辅助函数
// ============================================================
export * from './OntologyCanvas.helpers';

// ============================================================
// 批量工作台 (统一版本)
// ============================================================
export { BatchWorkbench } from './BatchWorkbench';
export type { BatchWorkbenchProps, NodeData } from './BatchWorkbench';

// ============================================================
// 高级对话框组件
// ============================================================
export { EdgePropertyDialog } from './EdgePropertyDialog';
export type { 
  EdgePropertyDialogProps, 
  EdgeProperties, 
  EdgePropertyUpdates,
  LinkType 
} from './EdgePropertyDialog';

export { HistoryPanel } from './HistoryPanel';
export type { HistoryPanelProps, HistoryEntry } from './HistoryPanel';

export { MeceLayerPanel } from './MeceLayerPanel';

// ============================================================
// 搜索增强
// ============================================================
export { SearchEnhancement } from './SearchEnhancement';
export type { SearchEnhancementProps } from './SearchEnhancement';

// ============================================================
// 快捷键帮助
// ============================================================
export { ShortcutsHelpDialog } from './ShortcutsHelpDialog';
export type { 
  ShortcutCategory,
  ShortcutItem,
  ShortcutsHelpDialogProps 
} from './ShortcutsHelpDialog';
export { useShortcuts } from './ShortcutsHelpDialog';

// ============================================================
// Hooks
// ============================================================
export { useSelection } from './hooks/useSelection';
export { useHistory } from './hooks/useHistory';
export { useClipboard } from './hooks/useClipboard';
export { useLayoutPresets } from './hooks/useLayoutPresets';
export type { LayoutPreset, UseLayoutPresetsReturn } from './hooks/useLayoutPresets';
export { useCanvasSnapshot } from './hooks/useCanvasSnapshot';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export type { 
  ShortcutConfig, 
  ShortcutMap, 
  UseKeyboardShortcutsOptions 
} from './hooks/useKeyboardShortcuts';
