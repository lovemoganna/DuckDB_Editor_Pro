/**
 * abstractionStore — Zustand 状态管理中心
 *
 * 基于 MECE 原则设计，将三个独立 hooks 的状态合并为单一 store
 * 解决 props drilling 问题，各组件直接从 store 读取
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  AbstractionTable,
  AbstractionSqlOperation,
  AbstractionLevel,
} from '../../types';
import {
  AbstractionFilters,
  DEFAULT_FILTERS,
  AbstractionGenerationRequest,
  AbstractionGenerationResult,
  AISession,
  AISessionMessage,
} from '../../types/abstraction';
import { ontologyAiService } from '../../services/ontologyAiService';
import {
  getAllAbstractionTables,
  saveAbstractionTable,
  updateAbstractionTable,
  deleteAbstractionTable,
} from '../../services/libraryStorage';
import {
  getAISessions,
  createAISession,
  updateAISession,
  deleteAISession,
} from '../../services/libraryStorage';

// ============================================================
// Types
// ============================================================

export type MainTab = 'library' | 'lab';
export type SandboxTab = 'editor' | 'results' | 'ai';

// Library slice
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

// Filter slice
interface FilterSlice {
  filters: AbstractionFilters;
}

// AI slice
interface AISlice {
  isGenerating: boolean;
  aiResult: AbstractionGenerationResult | null;
  aiError: string | null;
  aiRequest: AbstractionGenerationRequest | null;
}

// Sandbox slice
interface SandboxSlice {
  sandboxSql: string;
  sandboxResult: unknown;
  sandboxError: string | null;
  sandboxTab: SandboxTab;
  sandboxDraftName: string;
}

// Session slice — AI 会话（贯穿数据库生命周期）
interface SessionSlice {
  sessions: AISession[];
  activeSessionId: string | null;
  /** 当前正在等待 AI 响应的消息 id（用于流式 loading 展示） */
  pendingMessageId: string | null;
  /** 会话输入状态（表单字段，不属于某条消息） */
  inputConcept: string;
  inputProperty: string;
  inputRelation: string;
  inputContext: string;
  inputOperation: AbstractionSqlOperation;
}

// UI slice
interface UISlice {
  activeMainTab: MainTab;
  showForm: boolean;
  editingTable: AbstractionTable | null;
  showExportDialog: boolean;
  showHelp: boolean;
  copiedId: string | null;
}

// Full store type
type AbstractionStore = LibrarySlice & FilterSlice & AISlice & SandboxSlice & SessionSlice & UISlice & {
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
  setSandboxTab: (tab: SandboxTab) => void;
  setSandboxDraftName: (name: string) => void;
  executeSandboxSQL: (sql: string) => Promise<void>;
  saveSandboxAsTemplate: (name: string, domain: string) => Promise<void>;
  clearSandbox: () => void;

  // Session actions
  loadSessions: (database: string) => Promise<void>;
  createSession: (database: string, name?: string) => Promise<AISession>;
  selectSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, name: string) => Promise<void>;
  sendMessage: (request: AbstractionGenerationRequest) => Promise<void>;
  updateInputField: (field: 'concept' | 'property' | 'relation' | 'context', value: string) => void;
  setInputOperation: (op: AbstractionSqlOperation) => void;
  getActiveSession: () => AISession | null;

  // UI actions
  setActiveMainTab: (tab: MainTab) => void;
  openAddForm: () => void;
  openEditForm: (table: AbstractionTable) => void;
  closeForm: () => void;
  setShowExportDialog: (show: boolean) => void;
  setShowHelp: (show: boolean) => void;
};

// ============================================================
// Helpers
// ============================================================

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const applyFilters = (tables: AbstractionTable[], filters: AbstractionFilters): AbstractionTable[] => {
  let result = tables;

  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.tags.some(tag => tag.toLowerCase().includes(query)) ||
      t.sqlConfig.template.toLowerCase().includes(query)
    );
  }

  if (filters.domain !== 'all') {
    result = result.filter(t => t.domain === filters.domain);
  }

  if (filters.operation !== 'all') {
    result = result.filter(t => t.sqlConfig.operation === filters.operation);
  }

  if (filters.abstractionLevel !== 'all') {
    result = result.filter(t => !!t.abstractionPath[filters.abstractionLevel as keyof typeof t.abstractionPath]);
  }

  if (filters.tags.length > 0) {
    result = result.filter(t => filters.tags.some(tag => t.tags.includes(tag)));
  }

  if (filters.isFavorite) {
    result = result.filter(t => t.isFavorite);
  }

  if (filters.isSystem !== undefined) {
    result = result.filter(t => t.isSystem === filters.isSystem);
  }

  return result;
};

const computeStats = (tables: AbstractionTable[], filtered: AbstractionTable[]) => {
  const domains = Array.from(new Set(tables.map(t => t.domain))) as string[];
  return {
    total: tables.length,
    filtered: filtered.length,
    byDomain: domains.reduce((acc, d) => {
      acc[d] = tables.filter(t => t.domain === d).length;
      return acc;
    }, {} as Record<string, number>),
  };
};

// ============================================================
// Store
// ============================================================

export const useAbstractionStore = create<AbstractionStore>()(
  subscribeWithSelector((set, get) => ({
    // ── Library slice ──
    tables: [],
    selectedId: null,
    isLoading: false,
    domains: [],
    stats: { total: 0, filtered: 0, byDomain: {} },

    loadTables: async () => {
      set({ isLoading: true });
      try {
        const data = await getAllAbstractionTables();
        const tables = data.map((t, idx) => ({ ...t, id: t.id || `db-${idx}` }));
        const domains = Array.from(new Set(tables.map(t => t.domain))) as string[];
        const filtered = applyFilters(tables, get().filters);
        set({ tables, domains, stats: computeStats(tables, filtered), isLoading: false });
      } catch (error) {
        console.error('[abstractionStore] Failed to load tables:', error);
        set({ isLoading: false });
      }
    },

    selectTable: (id) => set({ selectedId: id }),

    addTable: async (table) => {
      const saved = await saveAbstractionTable(table);
      const tables = [...get().tables, saved];
      const domains = Array.from(new Set(tables.map(t => t.domain))) as string[];
      const filtered = applyFilters(tables, get().filters);
      set({ tables, domains, stats: computeStats(tables, filtered) });
      return saved;
    },

    updateTable: async (table) => {
      const updated = await updateAbstractionTable(table);
      const tables = get().tables.map(t => t.id === updated.id ? updated : t);
      const filtered = applyFilters(tables, get().filters);
      set({ tables, stats: computeStats(tables, filtered) });
      if (get().selectedId === updated.id) {
        set({ selectedId: updated.id });
      }
      return updated;
    },

    removeTable: async (id) => {
      await deleteAbstractionTable(id);
      const tables = get().tables.filter(t => t.id !== id);
      const filtered = applyFilters(tables, get().filters);
      set({ tables, stats: computeStats(tables, filtered) });
      if (get().selectedId === id) {
        set({ selectedId: null });
      }
    },

    toggleFavorite: async (id) => {
      const table = get().tables.find(t => t.id === id);
      if (!table) return;
      await get().updateTable({ ...table, isFavorite: !table.isFavorite });
    },

    setCopiedId: (id) => {
      set({ copiedId: id });
      if (id) {
        setTimeout(() => set({ copiedId: null }), 2000);
      }
    },

    // ── Filter slice ──
    filters: DEFAULT_FILTERS,

    setFilters: (updates) => {
      const newFilters = { ...get().filters, ...updates };
      const filtered = applyFilters(get().tables, newFilters);
      set({ filters: newFilters, stats: { ...get().stats, filtered: filtered.length } });
    },

    resetFilters: () => {
      const filtered = applyFilters(get().tables, DEFAULT_FILTERS);
      set({ filters: DEFAULT_FILTERS, stats: { ...get().stats, filtered: filtered.length } });
    },

    // ── AI slice ──
    isGenerating: false,
    aiResult: null,
    aiError: null,
    aiRequest: null,

    generate: async (request) => {
      set({ isGenerating: true, aiError: null, aiRequest: request });

      try {
        const result = await ontologyAiService.generateAbstractionSQL({
          operation: request.operation,
          concept: request.concept,
          property: request.property,
          relation: request.relation,
          context: request.context,
        });

        const aiResult: AbstractionGenerationResult = {
          sql: result.sql,
          explanation: result.explanation,
          patternType: result.patternType,
          tips: result.tips,
        };

        set({ aiResult, isGenerating: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI 生成失败，请检查 AI 配置';
        set({ aiError: message, isGenerating: false });
        throw err;
      }
    },

    clearAI: () => set({ aiResult: null, aiError: null, aiRequest: null }),

    applyGeneratedSQL: (sql) => {
      const { aiResult, aiRequest } = get();
      if (!aiResult) return;

      // 构建一个带有特殊 id 的预填充对象
      const prefillEditingTable = {
        id: '__prefill__' as const,
        name: aiRequest?.concept || '新建模板',
        description: aiResult.explanation || '',
        domain: '通用',
        abstractionPath: {
          concept: aiRequest?.concept || '',
          property: aiRequest?.property || '',
          relation: aiRequest?.relation || '',
          instance: aiRequest?.instance || '',
        },
        sqlConfig: {
          operation: aiRequest?.operation || 'SELECT',
          template: aiResult.sql,
        },
        tags: [],
        isSystem: false,
        isFavorite: false,
        createdAt: 0,
        updatedAt: 0,
      };

      set({
        aiResult: null, aiError: null, aiRequest: null,
        showForm: true, editingTable: prefillEditingTable
      });
    },

    // ── Sandbox slice ──
    sandboxSql: '',
    sandboxResult: null,
    sandboxError: null,
    sandboxTab: 'editor',
    sandboxDraftName: '未命名实验',

    setSandboxSql: (sql) => set({ sandboxSql: sql }),
    setSandboxResult: (result) => set({ sandboxResult: result, sandboxError: null }),
    setSandboxError: (error) => set({ sandboxError: error }),
    setSandboxTab: (tab) => set({ sandboxTab: tab }),
    setSandboxDraftName: (name) => set({ sandboxDraftName: name }),

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
        // 版本历史由 useAbstractionSandbox hook 在 handleExecute 成功后自动保存
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
        description: `由实验台保存的模板`,
        domain,
        abstractionPath,
        sqlConfig: {
          operation: aiRequest?.operation || 'SELECT',
          template: sandboxSql,
        },
        tags: ['实验台'],
        isSystem: false,
        isFavorite: false,
      });
    },

    clearSandbox: () => set({
      sandboxSql: '',
      sandboxResult: null,
      sandboxError: null,
      sandboxDraftName: '未命名实验',
    }),

    // ── Session slice ──
    sessions: [],
    activeSessionId: null,
    pendingMessageId: null,
    inputConcept: '',
    inputProperty: '',
    inputRelation: '',
    inputContext: '',
    inputOperation: 'AGGREGATE',

    loadSessions: async (database) => {
      try {
        const sessions = await getAISessions(database);
        set({ sessions });
      } catch (err) {
        console.error('[abstractionStore] Failed to load sessions:', err);
      }
    },

    createSession: async (database, name) => {
      const sessionName = name || `会话 ${new Date().toLocaleString('zh-CN')}`;
      const session = await createAISession(database, sessionName);
      set(state => ({
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
        inputConcept: '',
        inputProperty: '',
        inputRelation: '',
        inputContext: '',
        inputOperation: 'AGGREGATE',
      }));
      return session;
    },

    selectSession: (sessionId) => {
      if (sessionId === null) {
        set({
          activeSessionId: null,
          inputConcept: '',
          inputProperty: '',
          inputRelation: '',
          inputContext: '',
          inputOperation: 'AGGREGATE',
        });
      } else {
        // 加载会话消息，恢复输入状态为最新一条用户消息
        const session = get().sessions.find(s => s.id === sessionId);
        if (session && session.messages.length > 0) {
          const lastUser = [...session.messages].reverse().find(m => m.role === 'user');
          if (lastUser?.request) {
            set({
              activeSessionId: sessionId,
              inputConcept: lastUser.request.concept,
              inputProperty: lastUser.request.property || '',
              inputRelation: lastUser.request.relation || '',
              inputContext: lastUser.request.context || '',
              inputOperation: lastUser.request.operation,
            });
          } else {
            set({ activeSessionId: sessionId });
          }
        } else {
          set({ activeSessionId: sessionId });
        }
      }
    },

    deleteSession: async (sessionId) => {
      await deleteAISession(sessionId);
      set(state => {
        const sessions = state.sessions.filter(s => s.id !== sessionId);
        const activeSessionId = state.activeSessionId === sessionId
          ? (sessions[0]?.id || null)
          : state.activeSessionId;
        return { sessions, activeSessionId };
      });
    },

    renameSession: async (sessionId, name) => {
      const session = get().sessions.find(s => s.id === sessionId);
      if (!session) return;
      const updated = await updateAISession({ ...session, name });
      set(state => ({
        sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
      }));
    },

    sendMessage: async (request) => {
      const { activeSessionId, sessions } = get();

      // 确保有活跃会话
      let sessionId = activeSessionId;
      let session: AISession;

      if (!sessionId) {
        // 创建默认会话（当前连接的 DuckDB 名称作为数据库标识）
        const dbName = localStorage.getItem('duckdb_current_db') || 'default';
        session = await get().createSession(dbName);
        sessionId = session.id;
      } else {
        session = sessions.find(s => s.id === sessionId)!;
      }

      // 构建历史上下文：收集之前的 assistant 回复摘要
      const historySummary = session.messages
        .filter(m => m.role === 'assistant' && m.rawSummary)
        .map(m => `[${m.request?.concept || ''}] ${m.rawSummary}`)
        .join('\n');

      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // 添加用户消息
      const userMessage: AISessionMessage = {
        id: `${messageId}-user`,
        role: 'user',
        request,
        timestamp: Date.now(),
      };

      // 添加 pending assistant 消息
      const assistantMessage: AISessionMessage = {
        id: `${messageId}-assistant`,
        role: 'assistant',
        timestamp: Date.now(),
      };

      const updatedSession: AISession = {
        ...session,
        messages: [...session.messages, userMessage, assistantMessage],
        updatedAt: Date.now(),
      };

      // 乐观更新 UI
      set(state => ({
        sessions: state.sessions.map(s => s.id === sessionId ? updatedSession : s),
        pendingMessageId: assistantMessage.id,
        inputConcept: request.concept,
        inputProperty: request.property || '',
        inputRelation: request.relation || '',
        inputContext: request.context || '',
        inputOperation: request.operation,
      }));

      try {
        const result = await ontologyAiService.generateAbstractionSQL({
          operation: request.operation,
          concept: request.concept,
          property: request.property,
          relation: request.relation,
          context: request.context,
        });

        // 追加 AI 摘要到历史，用于后续上下文
        if (result.sql) {
          const summary = `生成了 ${request.operation} SQL: ${request.concept}`;
          const finalAssistant: AISessionMessage = {
            ...assistantMessage,
            result: {
              sql: result.sql,
              explanation: result.explanation,
              patternType: result.patternType,
              tips: result.tips,
            },
            rawSummary: summary,
          };
          const finalSession = {
            ...updatedSession,
            messages: updatedSession.messages.map(m =>
              m.id === assistantMessage.id ? finalAssistant : m
            ),
          };
          await updateAISession(finalSession);
          set(state => ({
            sessions: state.sessions.map(s => s.id === sessionId ? finalSession : s),
            pendingMessageId: null,
            // 同时更新旧的 AI slice（保持兼容性）
            aiResult: finalAssistant.result!,
          }));
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'AI 生成失败';
        const errorAssistant: AISessionMessage = {
          ...assistantMessage,
          error: errorMsg,
        };
        const errorSession = {
          ...updatedSession,
          messages: updatedSession.messages.map(m =>
            m.id === assistantMessage.id ? errorAssistant : m
          ),
        };
        await updateAISession(errorSession);
        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? errorSession : s),
          pendingMessageId: null,
          aiError: errorMsg,
        }));
      }
    },

    updateInputField: (field, value) => {
      switch (field) {
        case 'concept': set({ inputConcept: value }); break;
        case 'property': set({ inputProperty: value }); break;
        case 'relation': set({ inputRelation: value }); break;
        case 'context': set({ inputContext: value }); break;
      }
    },

    setInputOperation: (op) => set({ inputOperation: op }),

    getActiveSession: () => {
      const { sessions, activeSessionId } = get();
      return sessions.find(s => s.id === activeSessionId) || null;
    },

    // ── UI slice ──
    activeMainTab: 'library',
    showForm: false,
    editingTable: null,
    showExportDialog: false,
    showHelp: false,
    copiedId: null,

    setActiveMainTab: (tab) => set({ activeMainTab: tab }),

    openAddForm: () => set({ showForm: true, editingTable: null }),
    openEditForm: (table) => set({ showForm: true, editingTable: table }),
    closeForm: () => set({ showForm: false, editingTable: null }),

    setShowExportDialog: (show) => set({ showExportDialog: show }),
    setShowHelp: (show) => set({ showHelp: show }),
  }))
);

// ── Selectors ──
export const useSelectedTable = () => {
  const tables = useAbstractionStore(s => s.tables);
  const selectedId = useAbstractionStore(s => s.selectedId);
  return tables.find(t => t.id === selectedId) || null;
};

export const useFilteredTables = () => {
  const tables = useAbstractionStore(s => s.tables);
  const filters = useAbstractionStore(s => s.filters);
  return applyFilters(tables, filters);
};

export const useAIGenerating = () => {
  const isGenerating = useAbstractionStore(s => s.isGenerating);
  const aiResult = useAbstractionStore(s => s.aiResult);
  return isGenerating || !!aiResult;
};
