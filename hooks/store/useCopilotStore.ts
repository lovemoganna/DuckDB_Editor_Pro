/**
 * useCopilotStore — 全局 AI Copilot 侧边栏状态与会话管理 (Zustand)
 *
 * 核心特性：
 * 1. 独立常驻右侧边栏状态（开关、宽度拖拽记忆）
 * 2. 跨页面导航持久化：切换 Tab（仪表盘、数据、SQL、Schema）不会丢失会话历史与上下文
 * 3. 自动同步当前活动表、活动 Tab 与 Schema 上下文
 * 4. 多轮自然语言对话支持，内置 DuckDB SQL 代码块提取与一键在编辑器运行
 */

import { create } from 'zustand';
import { Tab } from '../../types';
import { aiService } from '../../services/aiService';
import { aiConfigStore, type AIProvider } from '../../services/aiConfigStore';
import { buildSchemaContext } from '../../services/sqlContextBuilder';
import {
  createCopilotSession,
  deleteCopilotSession,
  deriveSessionTitle,
  getActiveSessionId,
  getCopilotSession,
  listCopilotSessionMetas,
  renameCopilotSession,
  saveCopilotSession,
  setActiveSessionId,
  toSessionMeta,
  type CopilotSessionMeta,
} from '../../services/copilotSessionStorage';
import { useAppStore } from './useAppStore';
import { toastService } from '../../services/toastService';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sqlBlocks?: string[];
  isStreaming?: boolean;
  model?: string;
  error?: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  badge?: string;
}

export const AVAILABLE_COPILOT_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google', badge: '云端' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', badge: '云端' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude', badge: '云端' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', badge: '极速' },
  { id: 'llama3.2', name: 'Llama 3.2 (本地)', provider: 'ollama', badge: '本地' },
  { id: 'qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder (本地)', provider: 'lmstudio', badge: '本地' },
];

/** 格式化 Tab 中文友好名称 */
export const getCopilotTabName = (tab: Tab): string => {
  switch (tab) {
    case Tab.DASHBOARD: return '仪表盘';
    case Tab.DATA: return '数据网格';
    case Tab.STRUCTURE: return 'Schema 结构';
    case Tab.SQL: return 'SQL 编辑器';
    case Tab.DATAFLOW: return '数据流大屏';
    case Tab.METRICS: return '指标中心';
    case Tab.ANALYSIS_HUB: return '分析中心';
    default: return '工作台';
  }
};

/** 从回复文本中提取 SQL 代码块 */
export function extractSqlBlocks(content: string): string[] {
  const regex = /```sql\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const sql = match[1].trim();
    if (sql) blocks.push(sql);
  }
  return blocks;
}

/** 过滤历史遗留的开场套话，空会话不再塞欢迎消息 */
const isLegacyWelcomeContent = (content: string): boolean =>
  content.includes('AI 数据分析助手') || content.includes('AI Copilot，已连接');

const sanitizeSessionMessages = (messages: CopilotMessage[]): CopilotMessage[] =>
  messages.filter(
    (m) => !(m.role === 'assistant' && isLegacyWelcomeContent(m.content || '')),
  );

let persistTimer: ReturnType<typeof setTimeout> | null = null;

const clearPersistTimer = () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
};

const schedulePersist = (persistFn: () => void) => {
  clearPersistTimer();
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistFn();
  }, 250);
};

interface CopilotState {
  // 边栏展示与布局
  isOpen: boolean;
  width: number;
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setWidth: (width: number) => void;

  // 会话与消息历史（跨 Tab + IndexedDB 持久）
  messages: CopilotMessage[];
  inputValue: string;
  isGenerating: boolean;
  selectedModel: string;
  setInputValue: (val: string) => void;
  setSelectedModel: (modelName: string) => void;

  // 多会话
  sessions: CopilotSessionMeta[];
  activeSessionId: string | null;
  sessionsHydrated: boolean;
  showSessionHistory: boolean;
  setShowSessionHistory: (open: boolean) => void;
  hydrateSessions: () => Promise<void>;
  createNewSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  persistActiveSession: () => Promise<void>;

  // 上下文状态
  contextTable: string | null;
  /** 用户选中的关注表（可多选）；空数组表示不限定表 */
  contextTables: string[];
  /** 用户手动选定表后锁定，避免工作区切表覆盖多选 */
  contextPinned: boolean;
  contextTab: Tab;
  setContext: (ctx: {
    table?: string | null;
    tables?: string[];
    tab?: Tab;
    pin?: boolean;
  }) => void;
  toggleContextTable: (tableName: string) => void;
  clearContextTables: () => void;
  selectAllContextTables: (tableNames: string[]) => void;

  // 动作
  sendMessage: (customPrompt?: string, onNavigate?: (tab: Tab) => void) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => void;
  runSqlInEditor: (sql: string, onNavigate?: (tab: Tab) => void) => void;
}

const getInitialOpen = (): boolean => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('copilot_sidebar_open');
  if (saved !== null) {
    return saved === 'true';
  }
  // 宽屏默认展开，窄屏默认收起
  return window.innerWidth >= 1280;
};

const getInitialWidth = (): number => {
  if (typeof window === 'undefined') return 420;
  const saved = localStorage.getItem('copilot_sidebar_width');
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 320 && parsed <= 720) {
      return parsed;
    }
  }
  return 420;
};

const getInitialModel = (): string => {
  const cfg = aiConfigStore.getConfig();
  const matched = AVAILABLE_COPILOT_MODELS.find(m => m.id === cfg.model || m.name === cfg.model);
  return matched ? matched.name : (cfg.model || 'Gemini 2.0 Flash');
};

export const useCopilotStore = create<CopilotState>((set, get) => ({
  isOpen: getInitialOpen(),
  width: getInitialWidth(),

  setIsOpen: (isOpen: boolean) => {
    try {
      localStorage.setItem('copilot_sidebar_open', String(isOpen));
    } catch {}
    set({ isOpen });
  },

  toggleOpen: () => {
    const next = !get().isOpen;
    try {
      localStorage.setItem('copilot_sidebar_open', String(next));
    } catch {}
    set({ isOpen: next });
  },

  setWidth: (width: number) => {
    const clamped = Math.max(320, Math.min(720, width));
    try {
      localStorage.setItem('copilot_sidebar_width', String(clamped));
    } catch {}
    set({ width: clamped });
  },

  messages: [],
  inputValue: '',
  isGenerating: false,
  selectedModel: getInitialModel(),

  sessions: [],
  activeSessionId: null,
  sessionsHydrated: false,
  showSessionHistory: false,
  setShowSessionHistory: (showSessionHistory) => set({ showSessionHistory }),

  setInputValue: (inputValue: string) => set({ inputValue }),

  setSelectedModel: (modelName: string) => {
    const option = AVAILABLE_COPILOT_MODELS.find(m => m.name === modelName || m.id === modelName);
    if (option) {
      try {
        aiConfigStore.setConfig({ provider: option.provider, model: option.id });
        useAppStore.getState().setAiConfig({ provider: option.provider, model: option.id });
        toastService.info(`已切换 AI Copilot 模型为 ${option.name}`);
      } catch {}
    }
    set({ selectedModel: modelName });
    void get().persistActiveSession();
  },

  hydrateSessions: async () => {
    if (get().sessionsHydrated) return;
    try {
      const current = get();
      const hasLiveUserTurns = current.messages.some((m) => m.role === 'user');

      const metas = await listCopilotSessionMetas();
      const preferredId = getActiveSessionId();
      let active = preferredId ? await getCopilotSession(preferredId) : null;
      if (!active && metas.length > 0) {
        active = await getCopilotSession(metas[0].id);
      }

      if (active) {
        setActiveSessionId(active.id);
        const storedMessages = sanitizeSessionMessages(active.messages as CopilotMessage[]);
        const messages = hasLiveUserTurns ? current.messages : storedMessages;
        set({
          sessions: metas,
          activeSessionId: active.id,
          sessionsHydrated: true,
          messages,
          contextTables: hasLiveUserTurns ? current.contextTables : active.contextTables || [],
          contextTable: hasLiveUserTurns
            ? current.contextTable
            : active.contextTable ?? (active.contextTables?.[0] ?? null),
          contextPinned: hasLiveUserTurns
            ? current.contextPinned
            : (active.contextTables?.length ?? 0) > 0,
          selectedModel: active.selectedModel || current.selectedModel,
          showSessionHistory: false,
        });
        if (hasLiveUserTurns || storedMessages.length !== (active.messages?.length ?? 0)) {
          void get().persistActiveSession();
        }
        return;
      }

      // First launch: create an empty durable session
      const seedMessages = hasLiveUserTurns ? current.messages : [];
      const created = await createCopilotSession({
        name: hasLiveUserTurns ? deriveSessionTitle(seedMessages, '新对话') : '新对话',
        messages: seedMessages,
        contextTables: current.contextTables,
        contextTable: current.contextTable,
        selectedModel: current.selectedModel,
      });
      set({
        sessions: [toSessionMeta(created)],
        activeSessionId: created.id,
        sessionsHydrated: true,
        messages: sanitizeSessionMessages(created.messages as CopilotMessage[]),
      });
    } catch (err) {
      console.warn('[Copilot] hydrateSessions failed', err);
      toastService.warning('会话历史加载失败，可稍后重试');
      set({ sessionsHydrated: true });
    }
  },

  persistActiveSession: async () => {
    const state = get();
    // 快照当前线程，避免 await 期间切走后把新线程消息写错 id
    const snapshot = {
      messages: state.messages,
      contextTables: state.contextTables,
      contextTable: state.contextTable,
      selectedModel: state.selectedModel,
    };
    try {
      let sessionId = state.activeSessionId;
      let existing = sessionId ? await getCopilotSession(sessionId) : null;

      if (!sessionId) {
        if (get().activeSessionId) {
          sessionId = get().activeSessionId;
          existing = sessionId ? await getCopilotSession(sessionId) : null;
        }
      }

      if (!sessionId) {
        const created = await createCopilotSession({
          name: deriveSessionTitle(snapshot.messages, '新对话'),
          messages: snapshot.messages,
          contextTables: snapshot.contextTables,
          contextTable: snapshot.contextTable,
          selectedModel: snapshot.selectedModel,
        });
        if (!get().activeSessionId) {
          setActiveSessionId(created.id);
          set({ activeSessionId: created.id });
        }
        sessionId = created.id;
        existing = created;
      }

      const nameFromMessages = deriveSessionTitle(snapshot.messages, existing?.name || '新对话');
      const keepCustomName =
        existing &&
        existing.name !== '新对话' &&
        !existing.name.endsWith('…') &&
        existing.name !== deriveSessionTitle(existing.messages, '新对话');

      const saved = await saveCopilotSession({
        id: sessionId!,
        name: keepCustomName ? existing!.name : nameFromMessages,
        messages: snapshot.messages,
        contextTables: snapshot.contextTables,
        contextTable: snapshot.contextTable,
        selectedModel: snapshot.selectedModel,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      const metas = await listCopilotSessionMetas();
      // 切走后绝不能把 active 拨回 saved.id
      set((s) => ({
        sessions: metas,
        ...(s.activeSessionId === sessionId || s.activeSessionId === null
          ? { activeSessionId: saved.id }
          : {}),
      }));
      if (get().activeSessionId === saved.id) {
        setActiveSessionId(saved.id);
      }
    } catch (err) {
      console.warn('[Copilot] persistActiveSession failed', err);
    }
  },

  createNewSession: async () => {
    clearPersistTimer();
    const state = get();
    if (state.isGenerating) {
      toastService.warning('请先停止当前生成再新建会话');
      return;
    }
    if (state.activeSessionId) {
      await get().persistActiveSession();
    }
    try {
      const created = await createCopilotSession({
        name: '新对话',
        messages: [],
        contextTables: state.contextTables,
        contextTable: state.contextTable,
        selectedModel: state.selectedModel,
      });
      const metas = await listCopilotSessionMetas();
      set({
        sessions: metas,
        activeSessionId: created.id,
        messages: [],
        inputValue: '',
        showSessionHistory: false,
      });
      toastService.success('已新建 Copilot 会话');
    } catch (err: any) {
      toastService.error(`新建会话失败: ${err?.message || String(err)}`);
    }
  },

  switchSession: async (id: string) => {
    clearPersistTimer();
    const state = get();
    if (state.isGenerating) {
      toastService.warning('请先停止当前生成再切换会话');
      return;
    }
    if (state.activeSessionId === id) {
      set({ showSessionHistory: false });
      return;
    }

    const fromId = state.activeSessionId;
    const snapshot = {
      messages: state.messages,
      contextTables: state.contextTables,
      contextTable: state.contextTable,
      selectedModel: state.selectedModel,
    };

    if (fromId) {
      try {
        const existing = await getCopilotSession(fromId);
        const nameFromMessages = deriveSessionTitle(snapshot.messages, existing?.name || '新对话');
        const keepCustomName =
          existing &&
          existing.name !== '新对话' &&
          !existing.name.endsWith('…') &&
          existing.name !== deriveSessionTitle(existing.messages, '新对话');
        await saveCopilotSession({
          id: fromId,
          name: keepCustomName ? existing!.name : nameFromMessages,
          messages: snapshot.messages,
          contextTables: snapshot.contextTables,
          contextTable: snapshot.contextTable,
          selectedModel: snapshot.selectedModel,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn('[Copilot] flush before switch failed', err);
      }
    }

    try {
      const session = await getCopilotSession(id);
      if (!session) {
        toastService.error('会话不存在或已被删除');
        const metas = await listCopilotSessionMetas();
        set({ sessions: metas });
        return;
      }
      setActiveSessionId(session.id);
      const metas = await listCopilotSessionMetas();
      set({
        sessions: metas,
        activeSessionId: session.id,
        messages: sanitizeSessionMessages(
          (session.messages.length > 0 ? session.messages : []) as CopilotMessage[],
        ),
        contextTables: session.contextTables || [],
        contextTable: session.contextTable ?? null,
        contextPinned: (session.contextTables?.length ?? 0) > 0,
        selectedModel: session.selectedModel || state.selectedModel,
        inputValue: '',
        showSessionHistory: false,
      });
      toastService.info(`已切换到「${session.name}」`);
    } catch (err: any) {
      toastService.error(`切换会话失败: ${err?.message || String(err)}`);
    }
  },

  renameSession: async (id: string, name: string) => {
    try {
      const updated = await renameCopilotSession(id, name);
      if (!updated) return;
      const metas = await listCopilotSessionMetas();
      set({ sessions: metas });
    } catch (err: any) {
      toastService.error(`重命名失败: ${err?.message || String(err)}`);
    }
  },

  deleteSession: async (id: string) => {
    const state = get();
    if (state.isGenerating && state.activeSessionId === id) {
      toastService.warning('请先停止当前生成再删除会话');
      return;
    }
    try {
      await deleteCopilotSession(id);
      let metas = await listCopilotSessionMetas();
      if (state.activeSessionId === id) {
        if (metas.length === 0) {
          const created = await createCopilotSession({
            name: '新对话',
            messages: [],
            selectedModel: state.selectedModel,
          });
          metas = [toSessionMeta(created)];
          set({
            sessions: metas,
            activeSessionId: created.id,
            messages: [],
            inputValue: '',
          });
        } else {
          await get().switchSession(metas[0].id);
          metas = await listCopilotSessionMetas();
          set({ sessions: metas });
        }
      } else {
        set({ sessions: metas });
      }
      toastService.info('已删除会话');
    } catch (err: any) {
      toastService.error(`删除会话失败: ${err?.message || String(err)}`);
    }
  },

  contextTable: null,
  contextTables: [],
  contextPinned: false,
  contextTab: Tab.DASHBOARD,

  setContext: (ctx) => {
    set((state) => {
      let nextTables = state.contextTables;
      let nextPinned = ctx.pin !== undefined ? ctx.pin : state.contextPinned;

      if (ctx.tables !== undefined) {
        nextTables = Array.from(new Set(ctx.tables.filter(Boolean)));
        if (ctx.pin === undefined) nextPinned = true;
      } else if (ctx.table !== undefined) {
        // pin:false = 跟随工作区；pin:true / 未锁定 = 允许写入单表
        const canWriteTable = ctx.pin === true || ctx.pin === false || !state.contextPinned;
        if (canWriteTable) {
          nextTables = ctx.table ? [ctx.table] : [];
        }
      }

      const nextTable = nextTables[0] ?? null;
      const nextTab = ctx.tab !== undefined ? ctx.tab : state.contextTab;

      if (
        nextTable === state.contextTable &&
        nextTab === state.contextTab &&
        nextPinned === state.contextPinned &&
        nextTables.length === state.contextTables.length &&
        nextTables.every((t, i) => t === state.contextTables[i])
      ) {
        return state;
      }

      return {
        contextTable: nextTable,
        contextTables: nextTables,
        contextPinned: nextPinned,
        contextTab: nextTab,
      };
    });
  },

  toggleContextTable: (tableName: string) => {
    if (!tableName) return;
    set((state) => {
      const exists = state.contextTables.includes(tableName);
      const nextTables = exists
        ? state.contextTables.filter((t) => t !== tableName)
        : [...state.contextTables, tableName];
      return {
        contextTables: nextTables,
        contextTable: nextTables[0] ?? null,
        contextPinned: true,
      };
    });
  },

  clearContextTables: () => {
    set({
      contextTables: [],
      contextTable: null,
      contextPinned: true,
    });
  },

  selectAllContextTables: (tableNames: string[]) => {
    const unique = Array.from(new Set(tableNames.filter(Boolean)));
    set({
      contextTables: unique,
      contextTable: unique[0] ?? null,
      contextPinned: true,
    });
  },

  clearMessages: () => {
    // 「清空」= 新建会话，旧对话保留在历史中
    void get().createNewSession();
  },

  stopGeneration: () => {
    if (!get().isGenerating) return;
    try {
      aiService.cancelActiveRequest();
    } catch {}
    set((s) => ({
      isGenerating: false,
      messages: s.messages.map((m) =>
        m.isStreaming
          ? {
              ...m,
              isStreaming: false,
              content: m.content
                ? `${m.content}\n\n*(用户已主动停止生成)*`
                : '*(用户已主动停止生成)*',
              sqlBlocks: m.content ? extractSqlBlocks(m.content) : [],
            }
          : m
      ),
    }));
    toastService.info('已停止 AI 响应生成');
    void get().persistActiveSession();
  },

  runSqlInEditor: (sql: string, onNavigate?: (tab: Tab) => void) => {
    const trimmed = (sql || '').trim();
    if (!trimmed) {
      toastService.warning('没有可载入的 SQL');
      return;
    }
    // WorkbenchView 通过 pendingSql 注入新工作表；旧 SqlEditorStore.createTab 已不再驱动 Tab.SQL
    useAppStore.getState().setPendingSql(trimmed);
    if (onNavigate) {
      onNavigate(Tab.SQL);
    } else {
      useAppStore.getState().setActiveTab(Tab.SQL);
    }
  },

  sendMessage: async (customPrompt?: string, onNavigate?: (tab: Tab) => void) => {
    const state = get();
    const promptText = (customPrompt ?? state.inputValue).trim();
    if (!promptText || state.isGenerating) return;

    if (!aiService.isConfigured()) {
      toastService.warning('AI 尚未配置 API 密钥，请在设置中配置');
      useAppStore.getState().setShowSettingsModal(true);
      return;
    }

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantPlaceholder: CopilotMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
      model: state.selectedModel,
    };

    set({
      messages: [...state.messages, userMessage, assistantPlaceholder],
      inputValue: '',
      isGenerating: true,
    });

    try {
      // 动态推导上下文
      const focusTables = state.contextTables.length > 0
        ? state.contextTables
        : (state.contextTable ? [state.contextTable] : []);
      let schemaCtx = '';
      try {
        schemaCtx = await buildSchemaContext(promptText, Math.max(6, focusTables.length + 2));
      } catch {
        // Schema context is best-effort
      }

      const historyPart = state.messages
        .filter(m => m.role !== 'system' && !m.isStreaming)
        .slice(-6)
        .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n\n');

      const contextualPrompt = [
        schemaCtx ? `【当前数据库完整元数据 Schema】\n${schemaCtx}` : '',
        focusTables.length > 0
          ? `【用户当前关注的数据表】: ${focusTables.join(', ')}`
          : '【用户当前关注的数据表】: 未限定（可参考全部表）',
        `【当前所在工作区视图】: ${getCopilotTabName(state.contextTab)}`,
        historyPart ? `【对话历史】\n${historyPart}` : '',
        `用户: ${promptText}`,
      ].filter(Boolean).join('\n\n');

      let accumulated = '';

      const fullResponse = await aiService.sendChatMessage(
        contextualPrompt,
        undefined,
        (chunk: string) => {
          accumulated += chunk;
          set((s) => ({
            messages: s.messages.map(m =>
              m.id === assistantId
                ? { ...m, content: accumulated, isStreaming: true }
                : m
            ),
          }));
        }
      );

      const sqlBlocks = extractSqlBlocks(fullResponse);

      set((s) => ({
        messages: s.messages.map(m =>
          m.id === assistantId
            ? { ...m, content: fullResponse, isStreaming: false, sqlBlocks }
            : m
        ),
      }));
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('停止') || err?.message?.includes('aborted')) {
        // 用户主动停止生成，已由 stopGeneration 处理消息状态，无需展示错误
        void get().persistActiveSession();
        return;
      }
      const errMsg = err?.message || String(err);
      toastService.error(`AI 响应异常: ${errMsg}`);
      if (errMsg.includes('API Key not configured') || errMsg.includes('尚未配置 AI API Key')) {
        toastService.warning('尚未配置 AI 服务密钥，请在设置中配置');
        useAppStore.getState().setShowSettingsModal(true);
      }
      set((s) => ({
        messages: s.messages.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: `❌ 请求失败：${errMsg}\n\n请检查 API 密钥或网络配置后重试。`,
                isStreaming: false,
                error: true,
              }
            : m
        ),
      }));
    } finally {
      set({ isGenerating: false });
      schedulePersist(() => {
        void get().persistActiveSession();
      });
    }
  },
}));
