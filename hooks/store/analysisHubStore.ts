/**
 * analysisHubStore.ts — Zustand store for Analysis Hub
 * 
 * Merged from:
 * - abstractionStore (Library, Filter, AI, Sandbox, Session, UI slices)
 * - SchemaGenerator state (Analysis, Handbook slices)
 * 
 * This is the canonical store for the Analysis Hub module.
 * All Abstraction and Analysis components should use this store.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
    AbstractionTable,
  AbstractionSqlOperation,
  AbstractionLevel,
  GenerationResult,
  AnalysisSummary,
  SavedAnalysis,
  AbstractionFilters,
  AISession,
  AISessionMessage,
  AbstractionGenerationRequest,
  AbstractionGenerationResult,
} from '../../types';
import {
  DEFAULT_FILTERS,
} from '../../types/abstraction';
import {
  getAllAbstractionTables,
  saveAbstractionTable,
  updateAbstractionTable,
  deleteAbstractionTable,
  getAISessions,
  createAISession,
  updateAISession,
  deleteAISession,
} from '../../services/libraryStorage';
import type { PipelineStage, PipelineError, PipelineContext, AnalysisViewMode, AnalysisHubMainTab } from '../../types/analysisHub';

// ============================================================
// Types
// ============================================================

export type AnalysisHubMainTab = 'library' | 'analysis' | 'lab';

// ============================================================
// Slices
// ============================================================

interface LibrarySlice {
  tables: AbstractionTable[];
  selectedId: string | null;
  isLoading: boolean;
  domains: string[];
  stats: {
    total: number;
    filtered: number;
    byDomain: Record<string, number>;
  };
}

interface FilterSlice {
  filters: AbstractionFilters;
}

interface AISlice {
  isGenerating: boolean;
  aiResult: AbstractionGenerationResult | null;
  aiError: string | null;
  aiRequest: AbstractionGenerationRequest | null;
}

interface SandboxSlice {
  sandboxSql: string;
  sandboxResult: unknown;
  sandboxError: string | null;
  sandboxTab: 'editor' | 'results' | 'ai';
  sandboxDraftName: string;
}

interface SessionSlice {
  sessions: AISession[];
  activeSessionId: string | null;
  pendingMessageId: string | null;
  inputConcept: string;
  inputProperty: string;
  inputRelation: string;
  inputContext: string;
  inputOperation: AbstractionSqlOperation;
}

interface AnalysisSlice {
  isProcessing: boolean;
  pipelineStage: PipelineStage;
  pipelineContext: PipelineContext;
  pipelineError: PipelineError | null;
  result: GenerationResult | null;
  activeSummary: AnalysisSummary | null;
  activeFileName: string | null;
  history: SavedAnalysis[];
  viewMode: AnalysisViewMode;
  handbookResult: unknown | null;
  handbookProgress: number;
  isGeneratingHandbook: boolean;
}

interface UISlice {
  activeMainTab: AnalysisHubMainTab;
  showForm: boolean;
  editingTable: AbstractionTable | null;
  showExportDialog: boolean;
  showHelp: boolean;
  copiedId: string | null;
}

type AnalysisHubStore = LibrarySlice & FilterSlice & AISlice & SandboxSlice & SessionSlice & AnalysisSlice & UISlice & {
  // Library actions
  loadTables: () => Promise<void>;
  selectTable: (id: string | null) => void;
  addTable: (table: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AbstractionTable>;
  updateTable: (table: AbstractionTable) => Promise<AbstractionTable>;
  removeTable: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setCopiedId: (id: string | null) => void;

  // Filter actions
  setFilters: (updates: Partial<AbstractionFilters>) => void;
  resetFilters: () => void;

  // AI actions
  generate: (request: AbstractionGenerationRequest) => Promise<void>;
  clearAI: () => void;
  applyGeneratedSQL: (sql: string) => void;

  // Sandbox actions
  setSandboxSql: (sql: string) => void;
  setSandboxResult: (result: unknown) => void;
  setSandboxError: (error: string | null) => void;
  setSandboxTab: (tab: SandboxSlice['sandboxTab']) => void;
  setSandboxDraftName: (name: string) => void;
  clearSandbox: () => void;
  executeSandboxSQL: (sql: string) => Promise<void>;
  saveSandboxAsTemplate: (name: string, domain: string) => Promise<void>;

  // Session actions
  loadSessions: () => Promise<void>;
  createSession: (concept: string, property: string, relation: string, context: string, operation: AbstractionSqlOperation) => Promise<AISession>;
  updateSession: (id: string, updates: Partial<AISession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string, role: 'user' | 'ai', sql?: string, error?: string) => Promise<void>;
  sendMessageCompat: (request: { concept: string; property?: string; relation?: string; operation: string; context?: string }) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  setPendingMessageId: (id: string | null) => void;
  setInput: (field: 'concept' | 'property' | 'relation' | 'context' | 'operation', value: string) => void;

  // UI actions
  setActiveMainTab: (tab: AnalysisHubMainTab) => void;
  openAddForm: () => void;
  openEditForm: (table: AbstractionTable) => void;
  closeForm: () => void;
  setShowExportDialog: (show: boolean) => void;
  setShowHelp: (show: boolean) => void;

  // Analysis actions
  setIsProcessing: (v: boolean) => void;
  setPipelineStage: (stage: PipelineStage) => void;
  setPipelineContext: (ctx: PipelineContext) => void;
  setPipelineError: (err: PipelineError | null) => void;
  setResult: (result: GenerationResult | null) => void;
  setActiveSummary: (summary: AnalysisSummary | null) => void;
  setActiveFileName: (name: string | null) => void;
  setHistory: (history: SavedAnalysis[]) => void;
  addToHistory: (entry: SavedAnalysis) => void;
  setViewMode: (mode: AnalysisViewMode) => void;
  setHandbookResult: (result: unknown | null) => void;
  setHandbookProgress: (progress: number) => void;
  setIsGeneratingHandbook: (v: boolean) => void;
  resetAnalysis: () => void;
};

// ============================================================
// Initial State
// ============================================================

const initialLibraryState = {
  tables: [] as AbstractionTable[],
  selectedId: null as string | null,
  isLoading: false,
  domains: [] as string[],
  stats: { total: 0, filtered: 0, byDomain: {} as Record<string, number> },
};

const initialFilterState = {
  filters: { ...DEFAULT_FILTERS },
};

const initialAIState = {
  isGenerating: false,
  aiResult: null as AbstractionGenerationResult | null,
  aiError: null as string | null,
  aiRequest: null as AbstractionGenerationRequest | null,
};

const initialSandboxState = {
  sandboxSql: '',
  sandboxResult: null as unknown,
  sandboxError: null as string | null,
  sandboxTab: 'editor' as const,
  sandboxDraftName: '',
};

const initialSessionState = {
  sessions: [] as AISession[],
  activeSessionId: null as string | null,
  pendingMessageId: null as string | null,
  inputConcept: '',
  inputProperty: '',
  inputRelation: '',
  inputContext: '',
  inputOperation: 'SELECT' as AbstractionSqlOperation,
};

const initialAnalysisState = {
  isProcessing: false,
  pipelineStage: 'idle' as PipelineStage,
  pipelineContext: {} as PipelineContext,
  pipelineError: null as PipelineError | null,
  result: null as GenerationResult | null,
  activeSummary: null as AnalysisSummary | null,
  activeFileName: null as string | null,
  history: [] as SavedAnalysis[],
  viewMode: 'result' as AnalysisViewMode,
  handbookResult: null as unknown | null,
  handbookProgress: 0,
  isGeneratingHandbook: false,
};

const initialUIState = {
  activeMainTab: 'library' as AnalysisHubMainTab,
  showForm: false,
  editingTable: null as AbstractionTable | null,
  showExportDialog: false,
  showHelp: false,
  copiedId: null as string | null,
};

// ============================================================
// Store
// ============================================================

export const useAnalysisHubStore = create<AnalysisHubStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialLibraryState,
    ...initialFilterState,
    ...initialAIState,
    ...initialSandboxState,
    ...initialSessionState,
    ...initialAnalysisState,
    ...initialUIState,

    // --- Library ---
    loadTables: async () => {
      set({ isLoading: true });
      try {
        const tables = await getAllAbstractionTables();
        const domains = [...new Set(tables.map(t => t.domain))];
        set({
          tables,
          domains,
          isLoading: false,
          stats: {
            total: tables.length,
            filtered: tables.length,
            byDomain: Object.fromEntries(domains.map(d => [d, tables.filter(t => t.domain === d).length])),
          },
        });
      } catch { set({ isLoading: false }); }
    },

    selectTable: (id) => set({ selectedId: id }),

    addTable: async (data) => {
      const table: AbstractionTable = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as AbstractionTable;
      await saveAbstractionTable(table);
      await get().loadTables();
      set({ selectedId: table.id });
      return table;
    },

    updateTable: async (table) => {
      const updated = { ...table, updatedAt: Date.now() };
      await updateAbstractionTable(updated);
      await get().loadTables();
      return updated;
    },

    removeTable: async (id) => {
      await deleteAbstractionTable(id);
      const { selectedId } = get();
      if (selectedId === id) set({ selectedId: null });
      await get().loadTables();
    },

    toggleFavorite: async (id) => {
      const { tables } = get();
      const table = tables.find(t => t.id === id);
      if (table) {
        const updated = { ...table, favorite: !table.favorite, updatedAt: Date.now() };
        await updateAbstractionTable(updated);
        await get().loadTables();
      }
    },

    setCopiedId: (id) => set({ copiedId: id }),

    // --- Filter ---
    setFilters: (updates) => set(state => ({ filters: { ...state.filters, ...updates } })),
    resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

    // --- AI ---
    generate: async (request) => {
      set({ isGenerating: true, aiError: null, aiRequest: request });
      try {
        const { ontologyAiService } = await import('../../services/ontologyAiService');
        const result = await ontologyAiService.generateAbstractionSQL(request);
        set({ aiResult: result, isGenerating: false });
      } catch (e: any) {
        set({ aiError: e.message, isGenerating: false });
      }
    },

    clearAI: () => set({ aiResult: null, aiError: null, aiRequest: null }),

    applyGeneratedSQL: (sql) => {
      const { setSandboxSql } = get();
      setSandboxSql(sql);
      set({ activeMainTab: 'lab' });
    },

    // --- Sandbox ---
    setSandboxSql: (sql) => set({ sandboxSql: sql }),
    setSandboxResult: (result) => set({ sandboxResult: result, sandboxError: null }),
    setSandboxError: (error) => set({ sandboxError: error }),
    setSandboxTab: (tab) => set({ sandboxTab: tab }),
    setSandboxDraftName: (name) => set({ sandboxDraftName: name }),
    clearSandbox: () => set({ sandboxSql: '', sandboxResult: null, sandboxError: null }),

    executeSandboxSQL: async (sql) => {
      const { duckDBService } = await import('../../services/duckdbService');
      set({ isGenerating: true, sandboxError: null, sandboxResult: null });
      try {
        const queryResult = await duckDBService.query(sql);
        if (Array.isArray(queryResult) && queryResult.length > 0 && 'columns' in queryResult[0]) {
          set({ sandboxResult: { columns: Object.keys(queryResult[0]), rows: queryResult, executionTime: 0 } });
        } else if (typeof queryResult === 'object' && queryResult !== null) {
          set({ sandboxResult: queryResult });
        } else {
          set({ sandboxResult: queryResult });
        }
      } catch (err) {
        set({ sandboxError: err instanceof Error ? err.message : '执行失败' });
      } finally {
        set({ isGenerating: false });
      }
    },

    saveSandboxAsTemplate: async (name, domain) => {
      const { sandboxSql, aiRequest } = get();
      if (!sandboxSql.trim()) return;
      const abstractionPath = aiRequest ? {
        concept: aiRequest.concept,
        property: aiRequest.property,
        relation: aiRequest.relation,
        instance: aiRequest.instance,
      } : { concept: name };
      await get().addTable({
        name,
        description: '由实验台保存的模板',
        domain,
        abstractionPath,
        sqlConfig: {
          operation: aiRequest?.operation || 'SELECT',
          template: sandboxSql,
        },
        tags: ['实验台'],
      });
    },

    // --- Session ---
    loadSessions: async () => {
      const sessions = await getAISessions();
      set({ sessions });
    },

    createSession: async (concept, property, relation, context, operation) => {
      const session = await createAISession({ concept, property, relation, context, operation });
      set(state => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
      return session;
    },

    updateSession: async (id, updates) => {
      await updateAISession(id, updates);
      await get().loadSessions();
    },

    deleteSession: async (id) => {
      await deleteAISession(id);
      set(state => ({
        sessions: state.sessions.filter(s => s.id !== id),
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
      }));
    },

    sendMessage: async (sessionId, content, role, sql, error) => {
      const message: AISessionMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        role,
        content,
        sql,
        error,
      };
      await updateAISession(sessionId, {
        messages: [...(get().sessions.find(s => s.id === sessionId)?.messages ?? []), message],
      });
      await get().loadSessions();
    },

    setActiveSession: (id) => set({ activeSessionId: id }),
    setPendingMessageId: (id) => set({ pendingMessageId: id }),

    setInput: (field, value) => {
      const setters: Record<string, () => void> = {
        concept: () => set({ inputConcept: value }),
        property: () => set({ inputProperty: value }),
        relation: () => set({ inputRelation: value }),
        context: () => set({ inputContext: value }),
        operation: () => set({ inputOperation: value as AbstractionSqlOperation }),
      };
      setters[field]?.();
    },

    // --- UI ---
    setActiveMainTab: (tab) => set({ activeMainTab: tab }),
    openAddForm: () => set({ showForm: true, editingTable: null }),
    openEditForm: (table) => set({ showForm: true, editingTable: table }),
    closeForm: () => set({ showForm: false, editingTable: null }),
    setShowExportDialog: (show) => set({ showExportDialog: show }),
    setShowHelp: (show) => set({ showHelp: show }),

    // --- Analysis ---
    setIsProcessing: (v) => set({ isProcessing: v }),
    setPipelineStage: (stage) => set({ pipelineStage: stage }),
    setPipelineContext: (ctx) => set({ pipelineContext: ctx }),
    setPipelineError: (err) => set({ pipelineError: err }),
    setResult: (result) => set({ result }),
    setActiveSummary: (summary) => set({ activeSummary: summary }),
    setActiveFileName: (name) => set({ activeFileName: name }),
    setHistory: (history) => set({ history }),
    addToHistory: (entry) => set(state => ({ history: [entry, ...state.history.filter(h => h.id !== entry.id)] })),
    setViewMode: (mode) => set({ viewMode: mode }),
    setHandbookResult: (result) => set({ handbookResult: result }),
    setHandbookProgress: (progress) => set({ handbookProgress: progress }),
    setIsGeneratingHandbook: (v) => set({ isGeneratingHandbook: v }),

    resetAnalysis: () => set({
      isProcessing: false,
      pipelineStage: 'idle',
      pipelineContext: {} as PipelineContext,
      pipelineError: null,
      result: null,
      activeSummary: null,
      activeFileName: null,
      viewMode: 'result',
      handbookResult: null,
      handbookProgress: 0,
      isGeneratingHandbook: false,
    }),

    // --- Backward-compatible session aliases (for AbstractionChatSession) ---
    selectSession: (sessionId: string | null) => get().setActiveSession(sessionId),

    renameSession: async (sessionId: string, name: string) => {
      const session = get().sessions.find(s => s.id === sessionId);
      if (session) {
        await get().updateSession(sessionId, { name });
      }
    },

    getActiveSession: () => {
      const { sessions, activeSessionId } = get();
      return sessions.find(s => s.id === activeSessionId) || null;
    },

    updateInputField: (field: 'concept' | 'property' | 'relation' | 'context', value: string) => {
      get().setInput(field, value);
    },

    setInputOperation: (op: AbstractionSqlOperation) => {
      get().setInput('operation', op);
    },

    // Backward-compatible sendMessage that accepts AbstractionGenerationRequest (old API)
    sendMessageCompat: async (request: { concept: string; property?: string; relation?: string; operation: string; context?: string }) => {
      const { createSession, sessions, activeSessionId } = get();
      let sessionId = activeSessionId;

      if (!sessionId) {
        const session = await createSession(
          request.concept,
          request.property || '',
          request.relation || '',
          request.context || '',
          request.operation as AbstractionSqlOperation
        );
        sessionId = session.id;
      }

      await get().sendMessage(sessionId!, request.concept, 'user');
      // Fire-and-forget AI response (handled by store's AI slice)
    },
  }))
);

// ============================================================
// Selectors
// ============================================================

export const useSelectedTable = () => {
  const tables = useAnalysisHubStore(s => s.tables);
  const selectedId = useAnalysisHubStore(s => s.selectedId);
  return tables.find(t => t.id === selectedId) ?? null;
};

export const useFilteredTables = () => {
  const tables = useAnalysisHubStore(s => s.tables);
  const filters = useAnalysisHubStore(s => s.filters);
  return tables.filter(t => {
    const q = (filters.search || '').toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
    if (filters.domain && t.domain !== filters.domain) return false;
    if (filters.operation && t.sqlConfig.operation !== filters.operation) return false;
    if (filters.level && t.abstractionLevel !== filters.level) return false;
    if (filters.favoritesOnly && !t.isFavorite) return false;
    return true;
  });
};

export const useAIGenerating = () => useAnalysisHubStore(s => s.isGenerating);

// Backward-compatible alias — all existing files importing from abstractionStore
// should continue to work without changes
export const useAbstractionStore = useAnalysisHubStore;
