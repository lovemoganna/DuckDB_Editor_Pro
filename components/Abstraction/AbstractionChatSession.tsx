/**
 * AbstractionChatSession — AI 会话面板（支持贯穿数据库生命周期的持续会话）
 *
 * 功能：
 * - 会话列表管理（创建、切换、删除、重命名）
 * - 消息历史展示（用户消息 + AI 回复，支持重新生成）
 * - 输入表单（概念、维度、关联、业务场景）
 * - 结果操作（复制、发送到实验台、保存为模板）
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  RotateCcw,
  Wand2,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  X,
  ChevronRight,
  MessageSquare,
  Clock,
  MoreVertical,
} from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { OPERATION_CONFIG } from '../../types/abstraction';
import { AbstractionSqlOperation, AISession, AISessionMessage } from '../../types/abstraction';
import { OPERATION_SELECTED_CLASSES } from './abstractionColors';

const OPERATIONS: AbstractionSqlOperation[] = [
  'SELECT', 'AGGREGATE', 'JOIN', 'WINDOW', 'CTE', 'INSERT', 'UPDATE', 'DELETE'
];

// ── Session List Item ──────────────────────────────────────────

const SessionListItem: React.FC<{
  session: AISession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}> = ({ session, isActive, onSelect, onDelete, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastMsg = session.messages[session.messages.length - 1];
  const isPending = lastMsg?.role === 'assistant' && !lastMsg.result && !lastMsg.error;

  const handleRename = () => {
    if (editName.trim() && editName !== session.name) {
      onRename(editName.trim());
    } else {
      setEditName(session.name);
    }
    setEditing(false);
    setMenuOpen(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
        isActive
          ? 'bg-monokai-purple/20 border border-monokai-purple/40'
          : 'hover:bg-monokai-bg/60 border border-transparent'
      }`}
      onClick={!editing ? onSelect : undefined}
    >
      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-monokai-purple' : 'text-monokai-fg-muted/60'}`} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditName(session.name); setEditing(false); } }}
            className="w-full bg-monokai-bg border border-monokai-purple/50 rounded px-1.5 py-0.5 text-xs text-monokai-fg outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <p className={`font-medium truncate ${isActive ? 'text-monokai-fg' : 'text-monokai-fg-muted'}`}>
            {session.name}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-2.5 h-2.5 text-monokai-fg-muted/40" />
          <span className="text-monokai-fg-muted/50">{formatTime(session.updatedAt)}</span>
          {isPending && <span className="ml-1 flex items-center gap-0.5 text-monokai-blue"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> 生成中</span>}
          {session.messages.length > 0 && !isPending && (
            <span className="ml-1 text-monokai-fg-muted/40">{session.messages.length} 条消息</span>
          )}
        </div>
      </div>

      {isActive && !editing && (
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded hover:bg-monokai-bg text-monokai-fg-muted/60 hover:text-monokai-fg"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-monokai-surface border border-monokai-border rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                <button
                  onClick={e => { e.stopPropagation(); setEditing(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-monokai-fg hover:bg-monokai-bg transition-colors"
                >
                  <Edit3 className="w-3 h-3" /> 重命名
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-monokai-pink hover:bg-monokai-pink/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> 删除会话
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Message Bubble ─────────────────────────────────────────────

const MessageBubble: React.FC<{
  message: AISessionMessage;
  isPending?: boolean;
  onCopy: () => void;
  onSendToSandbox: () => void;
  onSaveTemplate: () => void;
  onRegenerate: () => void;
}> = ({ message, isPending, onCopy, onSendToSandbox, onSaveTemplate, onRegenerate }) => {
  const [copied, setCopied] = useState(false);
  const { request, result, error, rawSummary } = message;

  const handleCopy = () => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy();
    }
  };

  if (message.role === 'user') {
    return (
      <div className="flex gap-2 justify-end">
        <div className="max-w-[85%]">
          <div className="flex items-center gap-1.5 mb-1 justify-end">
            <span className="text-[10px] text-monokai-fg-muted/40">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="bg-gradient-to-r from-monokai-purple/20 to-monokai-blue/20 border border-monokai-purple/30 rounded-xl rounded-tr-sm px-3 py-2.5">
            <p className="text-xs text-monokai-fg leading-relaxed">
              <span className="font-semibold text-monokai-purple">{request?.operation && OPERATION_CONFIG[request.operation]?.label}</span>
              {request?.concept && <> · {request.concept}</>}
              {request?.property && <><br/><span className="text-monokai-fg-muted">维度：{request.property}</span></>}
              {request?.relation && <><br/><span className="text-monokai-fg-muted">关联：{request.relation}</span></>}
              {request?.context && <><br/><span className="text-monokai-fg-muted/60">{request.context}</span></>}
            </p>
          </div>
        </div>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-monokai-purple to-monokai-blue flex items-center justify-center flex-shrink-0 mt-5">
          <span className="text-[9px] text-white font-bold">U</span>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-2 justify-start">
      <div className="w-6 h-6 rounded-full bg-monokai-bg border border-monokai-border flex items-center justify-center flex-shrink-0 mt-5">
        <Sparkles className="w-3 h-3 text-monokai-purple" />
      </div>
      <div className="max-w-[85%]">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] text-monokai-fg-muted/40">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {rawSummary && <span className="text-[10px] text-monokai-blue/70">{rawSummary}</span>}
        </div>

        {isPending ? (
          <div className="bg-monokai-bg border border-monokai-border rounded-xl rounded-tl-sm px-3 py-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-monokai-purple animate-spin" />
              <span className="text-xs text-monokai-fg-muted">AI 思考中...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-monokai-pink/10 border border-monokai-pink/30 rounded-xl rounded-tl-sm px-3 py-2.5">
            <p className="text-xs text-monokai-pink">{error}</p>
            <button onClick={onRegenerate} className="mt-2 flex items-center gap-1 text-[10px] text-monokai-pink/70 hover:text-monokai-pink transition-colors">
              <RefreshCw className="w-3 h-3" /> 重新生成
            </button>
          </div>
        ) : result ? (
          <div className="space-y-2">
            {result.explanation && (
              <div className="bg-monokai-purple/10 border border-monokai-purple/30 rounded-xl rounded-tl-sm px-3 py-2">
                <p className="text-xs text-monokai-purple leading-relaxed">{result.explanation}</p>
              </div>
            )}
            <div className="bg-monokai-bg border border-monokai-border rounded-xl rounded-tl-sm overflow-hidden">
              <pre className="px-3 py-2.5 text-xs text-monokai-fg font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {result.sql}
              </pre>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-lg bg-monokai-bg border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg hover:border-monokai-fg-muted transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-monokai-green" /> : <Copy className="w-3 h-3" />}
                {copied ? '已复制' : '复制'}
              </button>
              <button
                onClick={onSendToSandbox}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-lg bg-monokai-bg border border-monokai-border text-monokai-fg-muted hover:text-monokai-blue hover:border-monokai-blue/50 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                实验台
              </button>
              <button
                onClick={onSaveTemplate}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-lg bg-monokai-purple/15 border border-monokai-purple/40 text-monokai-purple hover:bg-monokai-purple/25 transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                保存
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── Input Form ─────────────────────────────────────────────────

const InputForm: React.FC<{
  operation: AbstractionSqlOperation;
  concept: string;
  property: string;
  relation: string;
  context: string;
  isGenerating: boolean;
  onOperationChange: (op: AbstractionSqlOperation) => void;
  onConceptChange: (v: string) => void;
  onPropertyChange: (v: string) => void;
  onRelationChange: (v: string) => void;
  onContextChange: (v: string) => void;
  onGenerate: () => void;
}> = ({
  operation, concept, property, relation, context, isGenerating,
  onOperationChange, onConceptChange, onPropertyChange, onRelationChange, onContextChange, onGenerate,
}) => (
  <div className="space-y-2.5">
    <div className="flex flex-wrap gap-1">
      {OPERATIONS.map((op) => {
        const config = OPERATION_CONFIG[op];
        return (
          <button
            key={op}
            onClick={() => onOperationChange(op)}
            className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-all ${
              operation === op ? OPERATION_SELECTED_CLASSES[op] : 'bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg'
            }`}
          >
            {config?.label || op}
          </button>
        );
      })}
    </div>

    <input
      type="text"
      value={concept}
      onChange={e => onConceptChange(e.target.value)}
      placeholder="分析概念 *"
      className="w-full px-3 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-purple transition-colors"
    />
    <input
      type="text"
      value={property}
      onChange={e => onPropertyChange(e.target.value)}
      placeholder="分析维度（可选）"
      className="w-full px-3 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-purple transition-colors"
    />
    <input
      type="text"
      value={relation}
      onChange={e => onRelationChange(e.target.value)}
      placeholder="关联关系（可选）"
      className="w-full px-3 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-purple transition-colors"
    />
    <textarea
      value={context}
      onChange={e => onContextChange(e.target.value)}
      placeholder="业务背景（可选）"
      rows={1}
      className="w-full px-3 py-1.5 text-xs bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-purple transition-colors resize-none"
    />

    <button
      onClick={onGenerate}
      disabled={isGenerating || !concept.trim()}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-monokai-purple to-monokai-blue text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      {isGenerating ? (
        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 生成中...</>
      ) : (
        <><Wand2 className="w-3.5 h-3.5" /> 生成 SQL</>
      )}
    </button>
  </div>
);

// ── Main Panel ─────────────────────────────────────────────────

export const AbstractionChatSession: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSessionList, setShowSessionList] = useState(true);

  const sessions = useAnalysisHubStore(s => s.sessions);
  const activeSessionId = useAnalysisHubStore(s => s.activeSessionId);
  const pendingMessageId = useAnalysisHubStore(s => s.pendingMessageId);
  const inputConcept = useAnalysisHubStore(s => s.inputConcept);
  const inputProperty = useAnalysisHubStore(s => s.inputProperty);
  const inputRelation = useAnalysisHubStore(s => s.inputRelation);
  const inputContext = useAnalysisHubStore(s => s.inputContext);
  const inputOperation = useAnalysisHubStore(s => s.inputOperation);
  const isGenerating = useAnalysisHubStore(s => s.isGenerating);
  const aiError = useAnalysisHubStore(s => s.aiError);

  const {
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    sendMessageCompat,
    updateInputField,
    setInputOperation,
    getActiveSession,
    setSandboxSql,
  } = useAnalysisHubStore.getState();

  // 初始化时加载会话
  useEffect(() => {
    const dbName = localStorage.getItem('duckdb_current_db') || 'default';
    loadSessions(dbName);
  }, []);

  const activeSession = getActiveSession();
  const messages = activeSession?.messages || [];

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, pendingMessageId]);

  const handleGenerate = async () => {
    if (!inputConcept.trim()) return;
    await sendMessageCompat({
      concept: inputConcept.trim(),
      property: inputProperty.trim() || undefined,
      relation: inputRelation.trim() || undefined,
      operation: inputOperation,
      context: inputContext.trim() || undefined,
    });
  };

  const handleNewSession = async () => {
    await createSession('', '', '', '', 'SELECT');
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
  };

  const handleRenameSession = async (id: string, name: string) => {
    await renameSession(id, name);
  };

  const handleSendToSandbox = (sql: string) => {
    setSandboxSql(sql);
  };

  const handleApplyGeneratedSQL = (sql: string, request?: AISessionMessage['request']) => {
    if (!sql) return;
    useAnalysisHubStore.getState().applyGeneratedSQL(sql);
  };

  const handleRegenerate = async (msg: AISessionMessage) => {
    if (msg.request) {
      await sendMessageCompat(msg.request);
    }
  };

  const handleClearSession = () => {
    updateInputField('concept', '');
    updateInputField('property', '');
    updateInputField('relation', '');
    updateInputField('context', '');
  };

  return (
    <div className="flex flex-col h-full bg-monokai-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-monokai-border bg-monokai-bg">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-monokai-purple to-monokai-blue flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-monokai-fg">AI 会话</span>
          {activeSession && (
            <span className="text-[10px] text-monokai-fg-muted/50">{activeSession.messages.length} 条</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            className="p-1 rounded-md hover:bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg transition-colors"
            title="会话列表"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNewSession}
            className="p-1 rounded-md hover:bg-monokai-bg text-monokai-fg-muted hover:text-monokai-purple transition-colors"
            title="新建会话"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {activeSession && (
            <button
              onClick={handleClearSession}
              className="p-1 rounded-md hover:bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg transition-colors"
              title="清空输入"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Session List Sidebar */}
        {showSessionList && (
          <div className="w-44 border-r border-monokai-border flex flex-col bg-monokai-bg/40 overflow-y-auto">
            <div className="p-2">
              <button
                onClick={handleNewSession}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] rounded-lg bg-monokai-purple/20 border border-monokai-purple/40 text-monokai-purple hover:bg-monokai-purple/30 transition-colors"
              >
                <Plus className="w-3 h-3" />
                新建会话
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {sessions.length === 0 && (
                <p className="text-[10px] text-monokai-fg-muted/40 text-center py-4 px-2">
                  暂无会话记录
                </p>
              )}
              {sessions.map(session => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => selectSession(session.id)}
                  onDelete={() => handleDeleteSession(session.id)}
                  onRename={name => handleRenameSession(session.id, name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeSession ? (
            /* Empty state — prompt to create or select session */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-monokai-purple/20 to-monokai-blue/20 border border-monokai-purple/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-monokai-purple" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-monokai-fg mb-1">开启持续会话</p>
                <p className="text-xs text-monokai-fg-muted/60">
                  创建一个新会话，AI 将记住整个数据库生命周期的上下文
                </p>
              </div>
              <button
                onClick={handleNewSession}
                className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg bg-gradient-to-r from-monokai-purple to-monokai-blue text-white font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                创建第一个会话
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-monokai-purple/10 border border-monokai-purple/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-monokai-purple" />
                    </div>
                    <p className="text-xs text-monokai-fg-muted/50 max-w-[200px]">
                      输入你的分析概念，AI 将生成 SQL 模板
                    </p>
                  </div>
                )}
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isPending={msg.id === pendingMessageId}
                    onCopy={() => {}}
                    onSendToSandbox={() => msg.result?.sql && handleSendToSandbox(msg.result.sql)}
                    onSaveTemplate={() => msg.result?.sql && handleApplyGeneratedSQL(msg.result.sql, msg.request)}
                    onRegenerate={() => handleRegenerate(msg)}
                  />
                ))}
                {aiError && activeSession?.messages[activeSession.messages.length - 1]?.role !== 'assistant' && (
                  <div className="px-3 py-2.5 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg">
                    <p className="text-xs text-monokai-pink">{aiError}</p>
                  </div>
                )}
              </div>

              {/* Input Form */}
              <div className="border-t border-monokai-border bg-monokai-bg/60 px-3 py-3">
                <InputForm
                  operation={inputOperation}
                  concept={inputConcept}
                  property={inputProperty}
                  relation={inputRelation}
                  context={inputContext}
                  isGenerating={isGenerating}
                  onOperationChange={setInputOperation}
                  onConceptChange={v => updateInputField('concept', v)}
                  onPropertyChange={v => updateInputField('property', v)}
                  onRelationChange={v => updateInputField('relation', v)}
                  onContextChange={v => updateInputField('context', v)}
                  onGenerate={handleGenerate}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbstractionChatSession;
