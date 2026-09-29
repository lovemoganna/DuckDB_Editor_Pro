/**
 * CopilotSidebar — 独立常驻右侧 AI Copilot 协作面板
 *
 * 核心设计：
 * 1. 独立固定于工作区右侧，与中央主工作区（仪表盘、数据、SQL、Schema）长期并行不互相挤占。
 * 2. 支持拖拽调整宽度（320px ~ 720px）与展开/折叠切换。
 * 3. 跨 Tab 会话与上下文持久：用户在仪表盘提问后切至 SQL 编辑器，历史消息、回复与输入框完整保留。
 * 4. 内置 Markdown 渲染、SQL 代码块提取、一键复制与「在编辑器中运行」。
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  PanelRightClose,
  ChevronDown,
  Square,
  Table2,
  Sparkles,
  History,
  Plus,
  Search,
} from 'lucide-react';
import { Tab } from '../../types';
import { type TableItemDetail } from '../../hooks/useDashboardWorkflow';
import {
  useCopilotStore,
  AVAILABLE_COPILOT_MODELS,
  getCopilotTabName,
  type CopilotMessage,
} from '../../hooks/store/useCopilotStore';
import { toastService } from '../../services/toastService';
import { generateExplorePrompts } from '../../services/copilotExplorePrompts';
import { ChatMessageMarkdown } from '../chat/ChatMessageMarkdown';
import { CopilotSessionHistory } from './CopilotSessionHistory';

interface CopilotSidebarProps {
  tables?: Array<TableItemDetail | string>;
  currentTable?: string | null;
  onNavigate?: (tab: Tab) => void;
}

const tableNameOf = (t: TableItemDetail | string): string =>
  typeof t === 'string' ? t : t.name;

export const CopilotSidebar: React.FC<CopilotSidebarProps> = ({
  tables = [],
  currentTable = null,
  onNavigate,
}) => {
  const {
    isOpen,
    toggleOpen,
    width,
    setWidth,
    messages,
    inputValue,
    setInputValue,
    isGenerating,
    selectedModel,
    setSelectedModel,
    contextTable,
    contextTables,
    contextPinned,
    contextTab,
    setContext,
    toggleContextTable,
    clearContextTables,
    selectAllContextTables,
    sendMessage,
    stopGeneration,
    clearMessages,
    runSqlInEditor,
    hydrateSessions,
    sessionsHydrated,
    sessions,
    createNewSession,
    showSessionHistory,
    setShowSessionHistory,
  } = useCopilotStore();

  const [isDragging, setIsDragging] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [copiedSqlIdx, setCopiedSqlIdx] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [explorePrompts, setExplorePrompts] = useState<string[]>([]);
  const [explorePromptsKey, setExplorePromptsKey] = useState('');
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableTables = useMemo(
    () => Array.from(new Set(tables.map(tableNameOf).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [tables]
  );

  const selectedTables = contextTables.length > 0
    ? contextTables
    : (contextTable ? [contextTable] : []);

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return availableTables;
    return availableTables.filter((name) => name.toLowerCase().includes(q));
  }, [availableTables, tableFilter]);

  const selectionLabel = useMemo(() => {
    if (selectedTables.length === 0) return '所有表';
    if (selectedTables.length === 1) return selectedTables[0];
    if (selectedTables.length === 2) return `${selectedTables[0]}, ${selectedTables[1]}`;
    return `${selectedTables[0]} +${selectedTables.length - 1}`;
  }, [selectedTables]);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // 启动时从 IndexedDB 恢复会话历史
  useEffect(() => {
    if (!sessionsHydrated) {
      void hydrateSessions();
    }
  }, [sessionsHydrated, hydrateSessions]);

  // 清掉历史遗留的开场套话（内存 / 已 hydrate 的会话）
  useEffect(() => {
    if (!sessionsHydrated) return;
    const state = useCopilotStore.getState();
    const cleaned = state.messages.filter(
      (m) =>
        !(
          m.role === 'assistant' &&
          (m.content.includes('AI 数据分析助手') || m.content.includes('AI Copilot，已连接'))
        ),
    );
    if (cleaned.length !== state.messages.length) {
      useCopilotStore.setState({ messages: cleaned });
      void state.persistActiveSession();
    }
  }, [sessionsHydrated]);

  // 输入框自适应高度 (40px ~ 140px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const targetHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 40), 140);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [inputValue]);

  // 仅在未锁定且尚无选表时，用工作区当前表做一次种子填充
  useEffect(() => {
    if (contextPinned) return;
    if (selectedTables.length > 0) return;
    const seed = currentTable || (availableTables[0] ?? null);
    if (seed) {
      setContext({ table: seed, pin: false });
    }
  }, [currentTable, availableTables, contextPinned, selectedTables.length, setContext]);

  // 新消息自动滚动到底部
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // 点击外部关闭弹出菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setShowModelMenu(false);
      }
      if (tableMenuRef.current && !tableMenuRef.current.contains(target)) {
        setShowTableMenu(false);
      }
    };
    if (showModelMenu || showTableMenu) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showModelMenu, showTableMenu]);

  // 拖拽调整宽度
  const handleMouseDownResizer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(320, Math.min(720, startWidth + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [width, setWidth]);

  // 快捷键发送 (Ctrl+Enter 或 Cmd+Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void sendMessage(undefined, onNavigate);
    }
  };

  // 复制 SQL 语句
  const handleCopySql = (sql: string, key: string) => {
    void navigator.clipboard.writeText(sql);
    setCopiedSqlIdx(key);
    toastService.success('已复制 SQL 语句到剪贴板');
    setTimeout(() => setCopiedSqlIdx(null), 1500);
  };

  // 复制完整单条消息
  const handleCopyFullMessage = (content: string, id: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    toastService.success('已复制完整回答到剪贴板');
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  // 处理新建会话（原清空按钮：旧对话保留在历史中）
  const handleClearClick = () => {
    if (messages.length <= 1) {
      void createNewSession();
      return;
    }
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setConfirmClear(false);
    void createNewSession();
  };

  const handleFollowWorkspace = () => {
    setContext({ table: currentTable || availableTables[0] || null, pin: false });
    setShowTableMenu(false);
  };

  const selectedTablesKey = selectedTables.join('\0');

  // 切换关注表后，清空旧的探索问题，避免与当前选择不一致
  useEffect(() => {
    if (explorePromptsKey && explorePromptsKey !== selectedTablesKey) {
      setExplorePrompts([]);
      setExplorePromptsKey('');
    }
  }, [selectedTablesKey, explorePromptsKey]);

  const handleGenerateExplorePrompts = async () => {
    if (isGeneratingPrompts || isGenerating) return;
    setIsGeneratingPrompts(true);
    try {
      const prompts = await generateExplorePrompts(selectedTables);
      setExplorePrompts(prompts);
      setExplorePromptsKey(selectedTablesKey);
      if (prompts.length === 0) {
        toastService.warning('未能生成探索问题，请稍后重试');
      }
    } catch (err: any) {
      toastService.error(`生成探索问题失败: ${err?.message || String(err)}`);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // 格式化 Tab 友好名称
  const getTabLabel = (tab: Tab) => getCopilotTabName(tab);

  // 渲染消息内容（使用统一 Markdown 渲染器，支持标题、列表、表格、代码块等结构）
  const renderMessageBody = (msg: CopilotMessage) => {
    return (
      <ChatMessageMarkdown
        content={msg.content}
        onRunSql={(sql) => runSqlInEditor(sql, onNavigate)}
        onCopySql={(sql) => handleCopySql(sql, `${msg.id}-copy`)}
      />
    );
  };

  // 当边栏折叠时不渲染悬浮按钮（已支持 Ctrl+I 全局快捷键唤起）
  if (!isOpen) {
    return null;
  }

  const showQuickPrompts = !messages.some((m) => m.role === 'user') && !isGenerating;

  return (
    <aside
      aria-label="AI Copilot 侧边栏"
      className="relative z-20 flex h-full shrink-0 flex-col border-l border-monokai-border bg-monokai-sidebar text-monokai-fg select-text transition-[width] duration-75"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDownResizer}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-30 transition-colors ${
          isDragging ? 'bg-monokai-accent' : 'hover:bg-monokai-accent/40'
        }`}
        title="拖拽调整侧边栏宽度"
      />

      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-monokai-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm font-semibold tracking-tight text-monokai-fg">AI Copilot</span>

          <div className="relative min-w-0" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex max-w-[140px] items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
              title="切换大模型"
            >
              <span className="truncate">{selectedModel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>

            {showModelMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-monokai-border bg-monokai-elevated py-1 shadow-xl">
                {AVAILABLE_COPILOT_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.name);
                      setShowModelMenu(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      selectedModel === model.name
                        ? 'bg-monokai-accent/15 text-monokai-accent'
                        : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                    }`}
                  >
                    <span className="truncate">{model.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-monokai-comment">{model.badge}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setShowSessionHistory(!showSessionHistory)}
            className={`relative flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
              showSessionHistory
                ? 'bg-monokai-accent/15 text-monokai-accent'
                : 'text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg'
            }`}
            title="会话历史"
            aria-label="会话历史"
            aria-pressed={showSessionHistory}
          >
            <History className="h-3.5 w-3.5" />
            {sessions.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-monokai-accent px-0.5 text-[9px] font-bold leading-none text-monokai-bg">
                {sessions.length > 9 ? '9+' : sessions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => void createNewSession()}
            disabled={isGenerating}
            className="flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-40"
            title="新建会话"
            aria-label="新建会话"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {confirmClear ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearClick}
                className="rounded-md bg-monokai-pink/15 px-2 py-0.5 text-[11px] text-monokai-pink hover:bg-monokai-pink/25 transition-colors cursor-pointer"
                title="再次点击将归档当前对话并新建会话"
              >
                确定新建?
              </button>
              <button
                type="button"
                onClick={() => {
                  if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
                  setConfirmClear(false);
                }}
                className="rounded-md px-1.5 py-0.5 text-[11px] text-monokai-comment hover:text-monokai-fg cursor-pointer"
                title="取消"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleClearClick}
              disabled={isGenerating}
              className="flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-40"
              title="新建会话（当前对话保留在历史中）"
              aria-label="清空会话历史"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleOpen}
            className="flex h-7 w-7 items-center justify-center rounded-md text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
            title="收起侧边栏"
            aria-label="收起侧边栏"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CopilotSessionHistory />

      {/* Quiet context line with interactive table multi-select */}
      <div
        ref={tableMenuRef}
        className="relative shrink-0 border-b border-monokai-border/60 px-3 py-1.5 text-[11px] text-monokai-comment"
      >
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 truncate">{getTabLabel(contextTab)}</span>
          <span className="shrink-0 text-monokai-border">·</span>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                setShowTableMenu((v) => !v);
                setShowModelMenu(false);
                setTableFilter('');
              }}
              className={`flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors cursor-pointer ${
                showTableMenu
                  ? 'bg-monokai-elevated text-monokai-fg'
                  : 'text-monokai-fg-muted hover:bg-monokai-elevated hover:text-monokai-fg'
              }`}
              title="选择关注的数据表（可多选）"
              aria-label="选择关注的数据表"
              aria-expanded={showTableMenu}
              aria-haspopup="listbox"
            >
              <Table2 className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{selectionLabel}</span>
              {selectedTables.length > 0 && (
                <span className="shrink-0 rounded-sm bg-monokai-accent/15 px-1 text-[10px] tabular-nums text-monokai-accent">
                  {selectedTables.length}
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 shrink-0 opacity-60 transition-transform ${showTableMenu ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {showTableMenu && (
          <div
            className="copilot-table-menu absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-xl border"
            role="listbox"
            aria-multiselectable="true"
            aria-label="关注表列表"
          >
            {/* Search */}
            <div className="copilot-table-menu-section border-b px-2.5 pt-2.5 pb-2">
              <div className="copilot-table-menu-search flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-monokai-comment" />
                <input
                  type="text"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder="搜索表名"
                  className="w-full border-0 bg-transparent text-[12px] outline-none focus:outline-none focus:ring-0"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions */}
            <div className="copilot-table-menu-section flex items-center gap-0.5 border-b px-2 py-1">
              <button
                type="button"
                onClick={() => selectAllContextTables(availableTables)}
                disabled={availableTables.length === 0}
                className="copilot-table-menu-action rounded-md px-2 py-1 text-[11px] disabled:opacity-35 cursor-pointer transition-colors"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => clearContextTables()}
                className="copilot-table-menu-action rounded-md px-2 py-1 text-[11px] cursor-pointer transition-colors"
              >
                清空
              </button>
              <div className="mx-1 h-3 w-px bg-monokai-border" />
              <button
                type="button"
                onClick={handleFollowWorkspace}
                className="copilot-table-menu-action-accent rounded-md px-2 py-1 text-[11px] cursor-pointer transition-colors"
                title="取消锁定，跟随工作区当前表"
              >
                跟随工作区
              </button>
              <span className="ml-auto pr-1.5 text-[10px] tabular-nums text-monokai-comment">
                {filteredTables.length}/{availableTables.length}
              </span>
            </div>

            {/* Selected chips (when multi) */}
            {selectedTables.length > 0 && (
              <div className="copilot-table-menu-chips flex flex-wrap gap-1 border-b px-2.5 py-2">
                {selectedTables.map((name) => (
                  <button
                    key={`chip-${name}`}
                    type="button"
                    onClick={() => toggleContextTable(name)}
                    title={`取消选择 ${name}`}
                    className="copilot-table-menu-chip inline-flex max-w-[46%] items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] cursor-pointer transition-colors"
                  >
                    <span className="truncate font-mono">{name}</span>
                    <span className="opacity-70">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* List */}
            <div className="copilot-table-menu-section custom-scrollbar max-h-56 overflow-y-auto py-1">
              {filteredTables.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-monokai-comment">
                  {availableTables.length === 0 ? '暂无可用数据表' : '没有匹配的表名'}
                </div>
              ) : (
                filteredTables.map((name) => {
                  const checked = selectedTables.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleContextTable(name)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left cursor-pointer transition-colors"
                    >
                      <span className="copilot-table-menu-check flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px]">
                        {checked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] tracking-tight">
                        {name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="copilot-table-menu-footer border-t px-3 py-2 text-[10px] leading-relaxed">
              {selectedTables.length === 0
                ? '未限定表时，提问将参考全部 Schema'
                : contextPinned
                  ? `已锁定 ${selectedTables.length} 张关注表`
                  : `已选 ${selectedTables.length} 张表`}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col justify-center px-1 py-6">
            <p className="text-[13px] font-medium text-monokai-fg">有什么想查的？</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-monokai-comment">
              {selectedTables.length > 0
                ? `可围绕 ${selectedTables.slice(0, 3).join('、')}${selectedTables.length > 3 ? ' 等' : ''} 提问、生成 SQL 或做数据探查。`
                : '直接提问、生成 SQL，或先选关注表再探索。'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1.5 flex w-full items-center justify-between gap-2 text-[10px] text-monokai-comment">
                  <span>{isUser ? '你' : 'Copilot'}{msg.timestamp ? ` · ${msg.timestamp}` : ''}</span>
                  {!isUser && !msg.isStreaming && msg.content && (
                    <button
                      type="button"
                      onClick={() => handleCopyFullMessage(msg.content, msg.id)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded px-1 py-0.5 text-monokai-comment hover:bg-monokai-elevated hover:text-monokai-fg transition-all cursor-pointer"
                      title="复制完整回答"
                      aria-label="复制完整回答"
                    >
                      {copiedMsgId === msg.id ? (
                        <Check className="h-3 w-3 text-monokai-green" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[96%] text-[13px] leading-relaxed ${
                    isUser
                      ? 'rounded-lg bg-monokai-elevated px-3 py-2 text-monokai-fg'
                      : 'w-full text-monokai-fg'
                  }`}
                >
                  {msg.isStreaming && !msg.content ? (
                    <div className="flex items-center gap-2 py-0.5 text-xs text-monokai-comment">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>思考中…</span>
                    </div>
                  ) : (
                    <>
                      {renderMessageBody(msg)}
                      {msg.isStreaming && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-monokai-comment">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>生成中</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Explore prompts — generated from selected tables, not hard-coded */}
      {showQuickPrompts && (
        <div className="shrink-0 space-y-2 px-3 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateExplorePrompts()}
              disabled={isGeneratingPrompts || isGenerating}
              className="flex items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 py-1 text-[11px] text-monokai-fg hover:border-monokai-accent/40 hover:text-monokai-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                selectedTables.length > 0
                  ? `根据已选表（${selectedTables.join(', ')}）生成探索问题`
                  : '未选表时将围绕整个数据库生成探索问题'
              }
              aria-label="生成探索问题"
            >
              {isGeneratingPrompts ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>{explorePrompts.length > 0 ? '重新生成探索问题' : '生成探索问题'}</span>
            </button>
            {selectedTables.length > 0 && (
              <span className="truncate text-[10px] text-monokai-comment">
                基于 {selectedTables.length === 1 ? selectedTables[0] : `${selectedTables.length} 张表`}
              </span>
            )}
          </div>

          {explorePrompts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {explorePrompts.map((prompt, idx) => (
                <button
                  key={`${explorePromptsKey}-${idx}`}
                  type="button"
                  onClick={() => {
                    setInputValue(prompt);
                    textareaRef.current?.focus();
                  }}
                  className="max-w-full truncate rounded-md border border-monokai-border/80 bg-transparent px-2 py-1 text-left text-[11px] text-monokai-comment hover:border-monokai-border hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
                  title={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-monokai-border p-3">
        <div className="rounded-lg border border-monokai-border bg-monokai-bg focus-within:border-monokai-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="提问、生成 SQL 或分析数据…"
            disabled={isGenerating}
            className="custom-scrollbar w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs text-monokai-fg placeholder:text-monokai-comment/70 focus:outline-none"
          />

          <div className="flex items-center justify-end px-2 pb-2">
            <button
              type="button"
              onClick={isGenerating ? stopGeneration : () => void sendMessage(undefined, onNavigate)}
              disabled={!isGenerating && !inputValue.trim()}
              className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                isGenerating
                  ? 'bg-monokai-pink/15 text-monokai-pink hover:bg-monokai-pink/25'
                  : 'bg-monokai-accent text-monokai-bg hover:brightness-110'
              }`}
              title={isGenerating ? '停止 AI 生成' : '发送消息 (Ctrl+Enter)'}
              aria-label={isGenerating ? '停止生成' : '发送'}
            >
              {isGenerating ? (
                <>
                  <Square className="h-3 w-3 fill-current" />
                  <span>停止</span>
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  <span>发送</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
