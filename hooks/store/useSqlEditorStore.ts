/**
 * useSqlEditorStore — Zustand store for SqlEditor internal state
 *
 * Extracted from SqlEditor.tsx (Loop 2 of SqlEditor Pro refactor).
 *
 * Why a store (vs useState):
 *   - SqlEditor has ~25 useState calls. Moving them into a Zustand store lets
 *     child components (SqlEditorToolbar, SqlEditorResultTable, side panels)
 *     subscribe to slices independently and avoid re-rendering the whole tree.
 *   - The store has a `persist` middleware writing to localStorage so tabs
 *     survive page reloads. We intentionally re-use the original key
 *     `duckdb_sql_tabs` to preserve existing user data.
 *
 * Slices (kept in one file for simplicity — each is a small section):
 *   - tabsSlice       multi-tab management + localStorage persistence
 *   - historySlice    query history with filter + 100-item cap
 *   - schemaSlice     DuckDB schema tree + expanded tables
 *   - uiSlice         toast + modal flags + sidebar tab + sidebar filter
 *                     + live preview + cleared-content undo buffer
 *
 * The exported `useSqlEditorStore` is the combined store. Components should
 * use selectors (e.g. `useSqlEditorStore(s => s.tabs)`) for performance.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SqlTab, QueryHistoryItem, SavedQuery, ColumnInfo } from '../../types';

// ============================================================
// tabsSlice
// ============================================================

const DEFAULT_CODE = "-- Welcome to DuckDB! Try running this generator query (no tables required):\nSELECT \n    i AS id,\n    'User_' || i AS username,\n    CASE WHEN i % 2 = 0 THEN 'Active' ELSE 'Inactive' END AS status,\n    round(random() * 100, 2) AS score\nFROM range(1, 6) t(i);";

function createDefaultTab(): SqlTab {
  return {
    id: 'default-tab',
    title: 'Untitled Query',
    code: DEFAULT_CODE,
    result: null,
    history: [],
    historyIndex: -1,
    loading: false,
    viewMode: 'table',
    chartConfig: {
      id: 'default',
      title: 'Start Execution',
      type: 'bar',
      xKey: '',
      yKeys: [],
      yRightKeys: [],
      stacked: false,
      horizontal: false,
      aggregation: 'none',
    },
    page: 0,
    filterTerm: '',
  };
}

function freshTab(code: string = DEFAULT_CODE): SqlTab {
  return {
    id: Date.now().toString(),
    title: 'Untitled Query',
    code,
    result: null,
    history: [],
    historyIndex: -1,
    loading: false,
    viewMode: 'table',
    chartConfig: {
      id: 'default',
      title: 'Start Execution',
      type: 'bar',
      xKey: '',
      yKeys: [],
      yRightKeys: [],
      stacked: false,
      horizontal: false,
      aggregation: 'none',
    },
    page: 0,
    filterTerm: '',
  };
}

/**
 * Normalize a tab persisted from a previous session: drop non-serializable
 * fields and migrate deprecated chartConfig shape.
 */
function migrateTab(t: any): SqlTab {
  return {
    ...t,
    result: null,
    loading: false,
    filterTerm: t.filterTerm ?? '',
    chartConfig: {
      ...t.chartConfig,
      yKeys: t.chartConfig?.yKeys || (t.chartConfig?.yKey ? [t.chartConfig.yKey] : []),
      yRightKeys: t.chartConfig?.yRightKeys || [],
      stacked: t.chartConfig?.stacked || false,
      horizontal: t.chartConfig?.horizontal || false,
    },
  };
}

interface TabsSlice {
  tabs: SqlTab[];
  activeTabId: string;
  setTabs: (tabs: SqlTab[]) => void;
  setActiveTabId: (id: string) => void;
  createTab: (code?: string) => string;
  closeTab: (id: string) => void;
  updateActiveTab: (updates: Partial<SqlTab>) => void;
  updateTabById: (id: string, updates: Partial<SqlTab>) => void;
  getActiveTab: () => SqlTab | undefined;
  renameTab: (id: string, title: string) => void;
}

// ============================================================
// historySlice
// ============================================================

interface HistorySlice {
  history: QueryHistoryItem[];
  historyFilter: string;
  setHistory: (history: QueryHistoryItem[]) => void;
  setHistoryFilter: (q: string) => void;
  addHistory: (item: QueryHistoryItem) => void;
  clearHistory: () => void;
}

// ============================================================
// schemaSlice
// ============================================================

interface SchemaSlice {
  schemaTree: Record<string, ColumnInfo[]>;
  expandedTables: Set<string>;
  setSchemaTree: (tree: Record<string, ColumnInfo[]>) => void;
  toggleTableExpand: (table: string) => void;
}

// ============================================================
// uiSlice
// ============================================================

type SidebarTab = 'history' | 'saved' | 'schema' | 'help';
type ToastType = 'success' | 'info' | 'warning';
interface Toast { message: string; type: ToastType }

interface UiSlice {
  activeSidebarTab: SidebarTab;
  setActiveSidebarTab: (t: SidebarTab) => void;

  toast: Toast | null;
  showToast: (message: string, type?: ToastType) => void;
  clearToast: () => void;

  // Snippet menu (toolbar)
  showSnippetsMenu: boolean;
  setShowSnippetsMenu: (v: boolean) => void;
  expandedSnippetCategory: string | null;
  setExpandedSnippetCategory: (c: string | null) => void;
  hoveredSnippet: { label: string; sql: string } | null;
  setHoveredSnippet: (s: { label: string; sql: string } | null) => void;

  // Live preview
  showLivePreview: boolean;
  setShowLivePreview: (v: boolean) => void;

  // AI state
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  selectedSqlType: string;
  setSelectedSqlType: (v: string) => void;
  aiSuggestion: string;
  setAiSuggestion: (v: string) => void;
  aiOptimizationHistory: { sql: string; timestamp: number }[];
  setAiOptimizationHistory: (
    h: { sql: string; timestamp: number }[] | ((prev: { sql: string; timestamp: number }[]) => { sql: string; timestamp: number }[])
  ) => void;
  aiExplanation: string;
  setAiExplanation: (v: string) => void;
  showAiExplanation: boolean;
  setShowAiExplanation: (v: boolean) => void;
  aiExplanationHistory: any[];
  setAiExplanationHistory: (h: any[]) => void;

  // Loading flags
  isAiLoading: boolean;
  setIsAiLoading: (v: boolean) => void;
  isFixing: boolean;
  setIsFixing: (v: boolean) => void;
  isGeneratingPreview: boolean;
  setIsGeneratingPreview: (v: boolean) => void;
  isGeneratingSuggestion: boolean;
  setIsGeneratingSuggestion: (v: boolean) => void;

  // Modals
  showSaveModal: boolean;
  setShowSaveModal: (v: boolean) => void;
  showChartBuilder: boolean;
  setShowChartBuilder: (v: boolean) => void;
  editingChartId: string | null;
  setEditingChartId: (id: string | null) => void;
  showMaterializeModal: boolean;
  setShowMaterializeModal: (v: boolean) => void;
  materializeType: 'TABLE' | 'VIEW';
  setMaterializeType: (t: 'TABLE' | 'VIEW') => void;
  materializeName: string;
  setMaterializeName: (v: string) => void;
  showMaterializeMenu: boolean;
  setShowMaterializeMenu: (v: boolean) => void;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean) => void;
  showSkillAssistant: boolean;
  setShowSkillAssistant: (v: boolean) => void;

  // Save form
  saveQueryName: string;
  setSaveQueryName: (v: string) => void;
  saveAsWidget: boolean;
  setSaveAsWidget: (v: boolean) => void;
  widgetType: 'value' | 'table' | 'chart';
  setWidgetType: (v: 'value' | 'table' | 'chart') => void;

  // Auto-refresh
  autoRefreshInterval: number;
  setAutoRefreshInterval: (v: number) => void;

  // Editor
  editingTitleId: string | null;
  setEditingTitleId: (id: string | null) => void;
  tempTitle: string;
  setTempTitle: (v: string) => void;
  editorHeightPercent: number;
  setEditorHeightPercent: (v: number) => void;

  // Copy
  copiedField: string | null;
  setCopiedField: (v: string | null) => void;

  // Undo clear
  lastClearedContent: { sql: string; aiInput: string } | null;
  setLastClearedContent: (v: { sql: string; aiInput: string } | null) => void;
  liveSqlPreview: string;
  setLiveSqlPreview: (v: string) => void;

  // Saved queries (sidebar list)
  savedQueries: SavedQuery[];
  setSavedQueries: (q: SavedQuery[]) => void;

  // Auto-save draft
  lastSavedAt: number | null;
  setLastSavedAt: (t: number | null) => void;
}

// ============================================================
// Combined store
// ============================================================

type Store = TabsSlice & HistorySlice & SchemaSlice & UiSlice;

const HISTORY_KEY = 'duckdb_sql_history';
const TABS_KEY = 'duckdb_sql_tabs';

export const useSqlEditorStore = create<Store>()(
  persist(
    (set, get) => ({
      // ---------------- tabsSlice ----------------
      tabs: [createDefaultTab()],
      activeTabId: 'default-tab',
      setTabs: (tabs) => set({ tabs }),
      setActiveTabId: (id) => set({ activeTabId: id }),
      createTab: (code) => {
        const newTab = freshTab(code);
        set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
        return newTab.id;
      },
      closeTab: (id) => {
        const state = get();
        const newTabs = state.tabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          const fallback = createDefaultTab();
          set({ tabs: [fallback], activeTabId: fallback.id });
          return;
        }
        const nextActive =
          state.activeTabId === id ? newTabs[newTabs.length - 1].id : state.activeTabId;
        set({ tabs: newTabs, activeTabId: nextActive });
      },
      updateActiveTab: (updates) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, ...updates } : t)),
        }));
      },
      updateTabById: (id, updates) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },
      getActiveTab: () => {
        const s = get();
        return s.tabs.find((t) => t.id === s.activeTabId) || s.tabs[0];
      },
      renameTab: (id, title) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: title || 'Untitled' } : t)),
        }));
      },

      // ---------------- historySlice ----------------
      history: (() => {
        try {
          const raw = localStorage.getItem(HISTORY_KEY);
          if (raw) return JSON.parse(raw);
        } catch {}
        return [];
      })(),
      historyFilter: '',
      setHistory: (history) => set({ history }),
      setHistoryFilter: (q) => set({ historyFilter: q }),
      addHistory: (item) => {
        const updated = [item, ...get().history].slice(0, 100);
        set({ history: updated });
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {}
      },
      clearHistory: () => {
        set({ history: [] });
        try {
          localStorage.removeItem(HISTORY_KEY);
        } catch {}
      },

      // ---------------- schemaSlice ----------------
      schemaTree: {},
      expandedTables: new Set<string>(),
      setSchemaTree: (tree) => set({ schemaTree: tree }),
      toggleTableExpand: (table) => {
        const next = new Set(get().expandedTables);
        if (next.has(table)) next.delete(table);
        else next.add(table);
        set({ expandedTables: next });
      },

      // ---------------- uiSlice ----------------
      activeSidebarTab: 'schema',
      setActiveSidebarTab: (t) => set({ activeSidebarTab: t }),

      toast: null,
      showToast: (message, type = 'info') => set({ toast: { message, type } }),
      clearToast: () => set({ toast: null }),

      showSnippetsMenu: false,
      setShowSnippetsMenu: (v) => set({ showSnippetsMenu: v }),
      expandedSnippetCategory: '基础查询',
      setExpandedSnippetCategory: (c) => set({ expandedSnippetCategory: c }),
      hoveredSnippet: null,
      setHoveredSnippet: (s) => set({ hoveredSnippet: s }),

      showLivePreview: false,
      setShowLivePreview: (v) => set({ showLivePreview: v }),

      aiPrompt: '',
      setAiPrompt: (v) => set({ aiPrompt: v }),
      selectedSqlType: 'select',
      setSelectedSqlType: (v) => set({ selectedSqlType: v }),
      aiSuggestion: '',
      setAiSuggestion: (v) => set({ aiSuggestion: v }),
      aiOptimizationHistory: [],
      setAiOptimizationHistory: (h) =>
        set((s) => ({
          aiOptimizationHistory:
            typeof h === 'function'
              ? (h as (prev: { sql: string; timestamp: number }[]) => { sql: string; timestamp: number }[])(s.aiOptimizationHistory)
              : h,
        })),
      aiExplanation: '',
      setAiExplanation: (v) => set({ aiExplanation: v }),
      showAiExplanation: false,
      setShowAiExplanation: (v) => set({ showAiExplanation: v }),
      aiExplanationHistory: [],
      setAiExplanationHistory: (h) => set({ aiExplanationHistory: h }),

      isAiLoading: false,
      setIsAiLoading: (v) => set({ isAiLoading: v }),
      isFixing: false,
      setIsFixing: (v) => set({ isFixing: v }),
      isGeneratingPreview: false,
      setIsGeneratingPreview: (v) => set({ isGeneratingPreview: v }),
      isGeneratingSuggestion: false,
      setIsGeneratingSuggestion: (v) => set({ isGeneratingSuggestion: v }),

      showSaveModal: false,
      setShowSaveModal: (v) => set({ showSaveModal: v }),
      showChartBuilder: false,
      setShowChartBuilder: (v) => set({ showChartBuilder: v }),
      editingChartId: null,
      setEditingChartId: (id) => set({ editingChartId: id }),
      showMaterializeModal: false,
      setShowMaterializeModal: (v) => set({ showMaterializeModal: v }),
      materializeType: 'TABLE',
      setMaterializeType: (t) => set({ materializeType: t }),
      materializeName: '',
      setMaterializeName: (v) => set({ materializeName: v }),
      showMaterializeMenu: false,
      setShowMaterializeMenu: (v) => set({ showMaterializeMenu: v }),
      showExportMenu: false,
      setShowExportMenu: (v) => set({ showExportMenu: v }),
      showSkillAssistant: false,
      setShowSkillAssistant: (v) => set({ showSkillAssistant: v }),

      saveQueryName: '',
      setSaveQueryName: (v) => set({ saveQueryName: v }),
      saveAsWidget: false,
      setSaveAsWidget: (v) => set({ saveAsWidget: v }),
      widgetType: 'table',
      setWidgetType: (v) => set({ widgetType: v }),

      autoRefreshInterval: 0,
      setAutoRefreshInterval: (v) => set({ autoRefreshInterval: v }),

      editingTitleId: null,
      setEditingTitleId: (id) => set({ editingTitleId: id }),
      tempTitle: '',
      setTempTitle: (v) => set({ tempTitle: v }),
      editorHeightPercent: 50,
      setEditorHeightPercent: (v) => set({ editorHeightPercent: v }),

      copiedField: null,
      setCopiedField: (v) => set({ copiedField: v }),

      lastClearedContent: null,
      setLastClearedContent: (v) => set({ lastClearedContent: v }),
      liveSqlPreview: '',
      setLiveSqlPreview: (v) => set({ liveSqlPreview: v }),

      savedQueries: [],
      setSavedQueries: (q) => set({ savedQueries: q }),

      lastSavedAt: null,
      setLastSavedAt: (t) => set({ lastSavedAt: t }),
    }),
    {
      name: 'sql-editor-ui-v1',
      storage: createJSONStorage(() => localStorage),
      // Persist only the slices that matter across reloads.
      // Schema, toasts, modals, AI loading flags are ephemeral.
      partialize: (state) => ({
        tabs: state.tabs.map(t => ({ ...t, result: null, loading: false })),
        activeTabId: state.activeTabId,
        editorHeightPercent: state.editorHeightPercent,
        selectedSqlType: state.selectedSqlType,
        activeSidebarTab: state.activeSidebarTab,
        aiOptimizationHistory: state.aiOptimizationHistory,
      }),
      // On rehydrate, migrate legacy tab shapes.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        try {
          // Legacy migration from old `duckdb_sql_tabs` key.
          if ((!state.tabs || state.tabs.length === 0)) {
            const legacy = localStorage.getItem(TABS_KEY);
            if (legacy) {
              const parsed = JSON.parse(legacy);
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.tabs = parsed.map(migrateTab);
                state.activeTabId = parsed[0].id;
              }
            }
          } else {
            state.tabs = state.tabs.map(migrateTab);
          }
        } catch {
          // ignore corrupt persist
        }
      },
    }
  )
);

// ============================================================
// Toast auto-dismiss hook (call once from a top-level component)
// ============================================================

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Subscribe to toast changes and auto-dismiss after 2.5s.
 * Idempotent — call from a single component (SqlEditor root) and it'll
 * unsubscribe / re-subscribe as needed.
 */
export function useToastAutoDismiss(): void {
  useSqlEditorStore.subscribe((state, prev) => {
    if (state.toast && state.toast !== prev.toast) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        useSqlEditorStore.getState().clearToast();
      }, 2500);
    }
  });
}
