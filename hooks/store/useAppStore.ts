/**
 * useAppStore — 全局 App 状态 (Zustand)
 *
 * 目的：集中管理跨 Tab 共享状态，减少 App.tsx 的 useState 数量。
 * App.tsx 仍然负责初始化、导航渲染和跨 Tab 协调，但具体状态委托给这里。
 *
 * 原则：
 * - 仅放置被多个 Tab 组件共享的状态
 * - 每个 Tab 的私有状态留在 App.tsx 或 Tab 组件内部
 */

import { create } from 'zustand';
import { Tab } from '../../types';
import type { DatasetDefinition, AnalysisFilter } from '../../services/workbench/analysisTypes';
import { aiConfigStore, AIProvider } from '../../services/aiConfigStore';

export interface CurrentDatasetContext extends DatasetDefinition {
  origin?: 'home' | 'data' | 'sql';
  appliedFilters?: AnalysisFilter[];
}
interface AppState {
  activeDataset: CurrentDatasetContext | null;
  setActiveDataset: (dataset: CurrentDatasetContext | null) => void;
  // Navigation & Workspace Mode
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isZenMode: boolean;
  setIsZenMode: (v: boolean) => void;
  toggleZenMode: () => void;

  // Database
  tables: string[];
  setTables: (tables: string[]) => void;
  currentTable: string | null;
  setCurrentTable: (name: string | null) => void;
  /** Active DuckDB catalog (current_database()) — analysis domain isolation */
  currentDatabase: string;
  setCurrentDatabase: (name: string) => void;

  // Cross-Tab Communication (AI Skills → SQL Editor)
  pendingSql: string;
  setPendingSql: (sql: string) => void;
  pendingNewQuery: boolean;
  setPendingNewQuery: (value: boolean) => void;
  pendingChartConfig: any;
  setPendingChartConfig: (config: any) => void;
  /** Open Workbench AI panel after navigating to SQL (e.g. from Dashboard). */
  pendingAiPanel: 'explain' | 'analyze' | null;
  setPendingAiPanel: (panel: 'explain' | 'analyze' | null) => void;
  clearPending: () => void;

  /** Bumped when SQL succeeds so Home Board widgets re-run */
  dashboardRefreshTrigger: number;
  bumpDashboardRefresh: () => void;

  // Modals
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  showDuplicateModal: boolean;
  setShowDuplicateModal: (v: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (v: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  showProjectManagerModal: boolean;
  setShowProjectManagerModal: (v: boolean) => void;

  // AI Config
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  setAiConfig: (config: { provider?: string; apiKey?: string; baseUrl?: string; model?: string }) => void;

  // Notifications
  notifications: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeNotification: (id: string) => void;

  // Audit Logs
  auditLogs: any[];
  setAuditLogs: (logs: any[]) => void;
}

let notifCounter = 0;
const initialAIConfig = aiConfigStore.getConfig();

export const useAppStore = create<AppState>((set, get) => ({
  activeDataset: null,
  setActiveDataset: activeDataset => set({activeDataset}),
  // Navigation & Workspace Mode
  activeTab: Tab.DASHBOARD,
  setActiveTab: (tab) => set({ activeTab: tab }),
  isZenMode: false,
  setIsZenMode: (v) => set({ isZenMode: v }),
  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

  // Database
  tables: [],
  setTables: (tables) => set(state => {
    const removedSelection = state.currentTable !== null && !tables.includes(state.currentTable);
    const removedDataset = removedSelection && state.activeDataset?.kind === 'table'
      && state.activeDataset.table === state.currentTable;
    return {
      tables,
      ...(removedSelection ? { currentTable: null } : {}),
      ...(removedDataset ? { activeDataset: null } : {}),
    };
  }),
  currentTable: null,
  setCurrentTable: (name) => set(state => ({ currentTable: name, ...(name !== state.currentTable ? {activeDataset:null} : {}) })),
  currentDatabase: 'memory',
  setCurrentDatabase: (name) => set(state => ({ currentDatabase: name || 'memory', ...(state.currentDatabase !== (name || 'memory') ? {activeDataset:null,currentTable:null} : {}) })),

  // Cross-Tab
  pendingSql: '',
  pendingNewQuery: false,
  setPendingNewQuery: (value) => set({ pendingNewQuery: value }),
  pendingChartConfig: null,
  pendingAiPanel: null,
  setPendingSql: (sql) => set({ pendingSql: sql }),
  setPendingChartConfig: (config) => set({ pendingChartConfig: config }),
  setPendingAiPanel: (panel) => set({ pendingAiPanel: panel }),
  clearPending: () => set({ pendingSql: '', pendingNewQuery: false, pendingChartConfig: null, pendingAiPanel: null }),

  dashboardRefreshTrigger: 0,
  bumpDashboardRefresh: () =>
    set((state) => ({ dashboardRefreshTrigger: state.dashboardRefreshTrigger + 1 })),

  // Modals
  showCreateModal: false,
  setShowCreateModal: (v) => set({ showCreateModal: v }),
  showDuplicateModal: false,
  setShowDuplicateModal: (v) => set({ showDuplicateModal: v }),
  showImportModal: false,
  setShowImportModal: (v) => set({ showImportModal: v }),
  showSettingsModal: false,
  setShowSettingsModal: (v) => set({ showSettingsModal: v }),
  showExportModal: false,
  setShowExportModal: (v) => set({ showExportModal: v }),
  showProjectManagerModal: false,
  setShowProjectManagerModal: (v) => set({ showProjectManagerModal: v }),

  // AI Config
  aiProvider: initialAIConfig.provider,
  aiApiKey: initialAIConfig.apiKey,
  aiBaseUrl: initialAIConfig.baseUrl,
  aiModel: initialAIConfig.model,
  setAiConfig: (config) => {
    const next = aiConfigStore.setConfig({
      ...config,
      provider: config.provider as AIProvider | undefined,
    });
    set({
      aiProvider: next.provider,
      aiApiKey: next.apiKey,
      aiBaseUrl: next.baseUrl,
      aiModel: next.model,
    });
  },

  // Notifications
  notifications: [],
  addNotification: (message, type = 'info') => {
    const id = `notif-${++notifCounter}-${Date.now()}`;
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 3000);
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  // Audit
  auditLogs: [],
  setAuditLogs: (logs) => set({ auditLogs: logs }),
}));
