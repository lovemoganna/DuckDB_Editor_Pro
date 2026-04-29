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

interface AppState {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

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

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activeTab: Tab.DASHBOARD,
  setActiveTab: (tab) => set({ activeTab: tab }),

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
  aiProvider: localStorage.getItem('duckdb_ai_provider') || 'google',
  aiApiKey: localStorage.getItem('duckdb_ai_api_key') || '',
  aiBaseUrl: localStorage.getItem('duckdb_ai_base_url') || '',
  aiModel: localStorage.getItem('duckdb_ai_model') || 'gemini-2.0-flash-exp',
  setAiConfig: (config) => {
    const s = get();
    const updates: Partial<AppState> = {};
    if (config.provider !== undefined) {
      updates.aiProvider = config.provider;
      localStorage.setItem('duckdb_ai_provider', config.provider);
      if (!config.model) {
        updates.aiModel = config.provider === 'google' ? 'gemini-2.0-flash-exp' : 'llama-3.3-70b-versatile';
        localStorage.setItem('duckdb_ai_model', updates.aiModel);
      }
    }
    if (config.apiKey !== undefined) {
      updates.aiApiKey = config.apiKey;
      localStorage.setItem('duckdb_ai_api_key', config.apiKey);
    }
    if (config.baseUrl !== undefined) {
      updates.aiBaseUrl = config.baseUrl;
      localStorage.setItem('duckdb_ai_base_url', config.baseUrl);
    }
    if (config.model !== undefined) {
      updates.aiModel = config.model;
      localStorage.setItem('duckdb_ai_model', config.model);
    }
    set(updates);
  },

  // Notifications
  notifications: [],
  addNotification: (message, type = 'info') => {
    const id = `notif-${++notifCounter}-${Date.now()}`;
    set(state => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 3000);
  },
  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },

  // Audit
  auditLogs: [],
  setAuditLogs: (logs) => set({ auditLogs: logs }),
}));
