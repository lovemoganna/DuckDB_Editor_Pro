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
import { aiConfigStore, AIProvider } from '../../services/aiConfigStore';

interface AppState {
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

  // Cross-Tab Communication (AI Skills → SQL Editor)
  pendingSql: string;
  setPendingSql: (sql: string) => void;
  pendingChartConfig: any;
  setPendingChartConfig: (config: any) => void;
  clearPending: () => void;

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
  // Navigation & Workspace Mode
  activeTab: Tab.DASHBOARD,
  setActiveTab: (tab) => set({ activeTab: tab }),
  isZenMode: false,
  setIsZenMode: (v) => set({ isZenMode: v }),
  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

  // Database
  tables: [],
  setTables: (tables) => set({ tables }),
  currentTable: null,
  setCurrentTable: (name) => set({ currentTable: name }),

  // Cross-Tab
  pendingSql: '',
  pendingChartConfig: null,
  setPendingSql: (sql) => set({ pendingSql: sql }),
  setPendingChartConfig: (config) => set({ pendingChartConfig: config }),
  clearPending: () => set({ pendingSql: '', pendingChartConfig: null }),

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
