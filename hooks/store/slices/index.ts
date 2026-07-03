/**
 * slices/index.ts — Central export for all store slices
 *
 * Slice pattern follows Zustand best practices:
 * Each slice is a self-contained module with its own state and actions.
 * The main store combines them via the `combine` pattern.
 *
 * Available slices:
 * - navigationSlice: Tab navigation, sidebar, zen mode
 * - uiSlice: Modals, notifications, cross-tab communication
 * - aiConfigSlice: AI provider/model configuration
 */

export { createNavigationSlice, type NavigationSlice } from './navigationSlice';
export { createUISlice, type UISlice, type NotificationEntry } from './uiSlice';
export { createAIConfigSlice, type AIConfigSlice } from './aiConfigSlice';
export { createCrossSelectionSlice, type CrossSelectionSlice, useCrossSelection } from './crossSelectionSlice';
