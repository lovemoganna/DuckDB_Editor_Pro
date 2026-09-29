/**
 * AiChatModal — 全屏多轮自然语言对话面板
 *
 * 设计目标：
 * - 以自然语言对话为主，不预设 SQL 生成模式
 * - 连续多轮对话，完整展示历史消息
 * - 自动检测 AI 回复中的 SQL 代码块，提供「在 SQL 编辑器中运行」
 * - 大尺寸弹窗，提供真正的阅读与操作空间
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Copy,
  Check,
  Play,
  RotateCcw,
  Database,
  ChevronDown,
  Code2,
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { aiConfigStore, type AIProvider } from '../services/aiConfigStore';
import { buildSchemaContext } from '../services/sqlContextBuilder';
import { useAppStore } from '../hooks/store/useAppStore';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { toastService } from '../services/toastService';
import { Tab } from '../types';
import { type TableItemDetail } from '../hooks/useDashboardWorkflow';
import { ChatMessageMarkdown } from './chat/ChatMessageMarkdown';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sqlBlocks?: string[]; // extracted SQL code blocks
  isStreaming?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  badge?: string;
}

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  tables?: TableItemDetail[];
  currentTable?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_AI_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google', badge: '云端' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', badge: '云端' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude', badge: '云端' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', badge: '极速' },
  { id: 'llama3.2', name: 'Llama 3.2 (本地)', provider: 'ollama', badge: '本地' },
  { id: 'qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder (本地)', provider: 'lmstudio', badge: '本地' },
];


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 从消息内容中提取所有 SQL 代码块 */
function extractSqlBlocks(content: string): string[] {
  const regex = /```sql\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const sql = match[1].trim();
    if (sql) blocks.push(sql);
  }
  return blocks;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AiChatModal: React.FC<AiChatModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  tables = [],
  currentTable,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentConfig = aiConfigStore.getConfig();
  const matchedModel = AVAILABLE_AI_MODELS.find(
    m => m.id === currentConfig.model || m.name === currentConfig.model
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    matchedModel ? matchedModel.name : currentConfig.model || 'Gemini 2.0 Flash'
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInputValue('');
      setIsGenerating(false);
    }
  }, [isOpen]);

  const handleSelectModel = (modelOption: ModelOption) => {
    setSelectedModel(modelOption.name);
    setShowModelMenu(false);
    try {
      aiConfigStore.setConfig({ provider: modelOption.provider, model: modelOption.id });
      useAppStore.getState().setAiConfig({ provider: modelOption.provider, model: modelOption.id });
      toastService.info(`已切换 AI 模型为 ${modelOption.name}`);
    } catch {}
  };

  const handleRunSql = useCallback((sql: string) => {
    const trimmed = (sql || '').trim();
    if (!trimmed) return;
    useAppStore.getState().setPendingSql(trimmed);
    const sqlStore = useSqlEditorStore.getState();
    const existing = sqlStore.tabs.find((t) => t.code === trimmed);
    if (!existing) {
      sqlStore.createTab(trimmed);
    } else {
      sqlStore.setActiveTabId(existing.id);
    }
    onClose();
    onNavigate(Tab.SQL);
  }, [onClose, onNavigate]);


  const handleCopySql = useCallback((sql: string) => {
    navigator.clipboard.writeText(sql);
    toastService.success('SQL 已复制到剪贴板');
  }, []);

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isGenerating) return;

    if (!aiService.isConfigured()) {
      toastService.warning('AI 尚未配置 API 密钥，请在设置中配置');
      useAppStore.getState().setShowSettingsModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    // Add streaming placeholder for assistant
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
    }]);

    try {
      // Build schema context for SQL-related queries
      const primaryTable = currentTable || tables[0]?.name;
      let schemaCtx = '';
      try {
        schemaCtx = await buildSchemaContext(text, 5);
      } catch {
        // Schema context is optional
      }

      // Build full conversation context prompt
      const historyPart = messages
        .filter(m => !m.isStreaming)
        .slice(-8) // last 8 messages for context window
        .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n\n');

      const contextualPrompt = [
        schemaCtx ? `【当前数据库 Schema 上下文】\n${schemaCtx}` : '',
        primaryTable ? `【当前关注的表】: ${primaryTable}` : '',
        historyPart ? `【对话历史】\n${historyPart}` : '',
        `用户: ${text}`,
      ].filter(Boolean).join('\n\n');

      let fullResponse = '';

      // sendChatMessage supports multi-turn NL dialogue (not SQL-only mode)
      fullResponse = await aiService.sendChatMessage(
        contextualPrompt,
        undefined, // uses built-in conversational system prompt
        (chunk: string) => {
          fullResponse += chunk;
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: fullResponse, isStreaming: true }
              : m
          ));
        }
      );

      const sqlBlocks = extractSqlBlocks(fullResponse);

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: fullResponse, isStreaming: false, sqlBlocks }
          : m
      ));
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      toastService.error(`AI 请求失败: ${errMsg}`);
      if (errMsg.includes('API Key not configured') || errMsg.includes('尚未配置 AI API Key')) {
        toastService.warning('尚未配置 AI 服务密钥，请在设置中配置');
        useAppStore.getState().setShowSettingsModal(true);
      }
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content: `❌ 请求失败：${errMsg}\n\n请检查 AI 配置或网络后重试。`,
              isStreaming: false,
            }
          : m
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    toastService.info('对话历史已清空');
  };

  if (!isOpen) return null;

  const primaryTable = currentTable || tables[0]?.name;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      {/* Modal Container */}
      <div
        className="relative w-full max-w-3xl flex flex-col bg-[#0b1020] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ height: 'min(85vh, 820px)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#080d1a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI 数据分析助手</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                多轮自然语言对话 · DuckDB SQL 生成 · 数据洞察
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Context badge */}
            {primaryTable && (
              <span className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                <Database className="h-2.5 w-2.5" />
                {primaryTable}
              </span>
            )}

            {/* Model selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelMenu(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
                title="选择 AI 模型"
              >
                <span className="max-w-[120px] truncate">{selectedModel}</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
              </button>
              {showModelMenu && (
                <div className="absolute right-0 top-full mt-1 z-40 w-52 rounded-xl border border-white/10 bg-[#0d1527] py-1 shadow-2xl">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/5">
                    选择分析引擎
                  </div>
                  {AVAILABLE_AI_MODELS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        selectedModel === m.name
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.badge && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-slate-400 shrink-0">
                          {m.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear history */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="清空对话历史"
              >
                <RotateCcw className="h-3 w-3" />
                <span>清空</span>
              </button>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Messages Area ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 select-none">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">开始数据分析对话</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">
                用自然语言描述你的数据问题，AI 会与你对话并在需要时生成 DuckDB SQL
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm text-left">
                {[
                  primaryTable
                    ? `分析 ${primaryTable} 表的数据分布与缺失值质量`
                    : '解释 DuckDB 相比传统 SQL 数据库的核心优势',
                  '如何用 DuckDB 高效分析大型 Parquet / CSV 文件？',
                  primaryTable
                    ? `帮我对 ${primaryTable} 编写常用分组聚合分析 SQL`
                    : '什么是窗口函数？给出 DuckDB 下的经典应用示例',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="text-left rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 px-3.5 py-2.5 text-xs text-slate-300 hover:text-white transition-all cursor-pointer leading-relaxed"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar - assistant */}
              {message.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed select-text ${
                  message.role === 'user'
                    ? 'bg-indigo-600/25 border border-indigo-500/30 text-slate-100 rounded-tr-sm'
                    : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-sm'
                }`}
              >
                {/* Message content with unified Markdown rendering */}
                <div className="space-y-1">
                  {message.role === 'assistant' ? (
                    <ChatMessageMarkdown
                      content={message.content}
                      onRunSql={handleRunSql}
                      onCopySql={handleCopySql}
                    />
                  ) : (
                    <ChatMessageMarkdown
                      content={message.content}
                      className="text-slate-100"
                    />
                  )}
                  {message.isStreaming && (
                    <div className="inline-flex items-center gap-1.5 text-indigo-300 text-xs font-mono pt-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>正在深度思考与推导...</span>
                    </div>
                  )}
                </div>

                {/* Copy button for assistant messages */}
                {message.role === 'assistant' && !message.isStreaming && message.content && (
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(message.id, message.content)}
                    className="absolute -bottom-1.5 right-2 flex items-center gap-1 rounded-md border border-white/10 bg-[#0b1020] px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    style={{ opacity: copiedId === message.id ? 1 : undefined }}
                  >
                    {copiedId === message.id ? (
                      <><Check className="h-2.5 w-2.5 text-emerald-400" /> 已复制</>
                    ) : (
                      <><Copy className="h-2.5 w-2.5" /> 复制</>
                    )}
                  </button>
                )}

                {/* Timestamp */}
                <div className={`text-[10px] mt-1.5 font-mono ${message.role === 'user' ? 'text-indigo-300/60 text-right' : 'text-slate-500'}`}>
                  {message.timestamp}
                </div>
              </div>

              {/* Avatar - user */}
              {message.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-600/40 border border-slate-500/30 text-slate-300 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ── */}
        <div className="shrink-0 border-t border-white/10 bg-[#080d1a] px-4 py-3">
          {/* Generating indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-mono mb-2 px-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>AI 正在思考...</span>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                placeholder={
                  isGenerating
                    ? 'AI 正在回复中...'
                    : '用自然语言描述你的数据分析需求，或直接提问...'
                }
                rows={3}
                className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 transition-all custom-scrollbar leading-relaxed"
              />
              <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 font-mono pointer-events-none">
                Ctrl+Enter 发送
              </div>
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isGenerating || !inputValue.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              title={isGenerating ? 'AI 正在回复...' : '发送消息 (Ctrl+Enter)'}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <p className="mt-2 text-[10px] text-slate-500 font-mono px-1">
            AI 生成的 SQL 会自动显示运行按钮 · 内容仅供参考，请自行验证
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiChatModal;
