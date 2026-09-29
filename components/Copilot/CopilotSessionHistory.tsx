/**
 * CopilotSessionHistory — 侧边栏会话历史列表面板
 * 支持新建 / 切换 / 重命名 / 删除，数据来自 IndexedDB（useCopilotStore）。
 */

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  Clock,
  X,
  Check,
} from 'lucide-react';
import {
  useCopilotStore,
} from '../../hooks/store/useCopilotStore';
import type { CopilotSessionMeta } from '../../services/copilotSessionStorage';

const formatRelativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

const SessionRow: React.FC<{
  session: CopilotSessionMeta;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}> = ({ session, isActive, onSelect, onRename, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  useEffect(() => {
    setDraft(session.name);
  }, [session.name]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== session.name) onRename(next);
    else setDraft(session.name);
    setEditing(false);
  };

  return (
    <div
      className={`copilot-session-row group relative flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors ${
        isActive ? 'copilot-session-row--active' : ''
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="copilot-session-row-main min-w-0 flex-1 text-left"
        disabled={editing}
        aria-current={isActive ? 'true' : undefined}
        title={isActive ? '当前会话（点击关闭历史）' : `切换到「${session.name}」`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`copilot-session-row-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
              isActive ? 'is-active' : ''
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraft(session.name);
                  setEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="copilot-session-rename-input w-full rounded-md px-2 py-1 text-[12px] outline-none"
            />
          ) : (
            <span className="copilot-session-row-title min-w-0 flex-1 truncate text-[12px] font-medium">
              {session.name}
            </span>
          )}
          {isActive && !editing && (
            <span className="copilot-session-row-badge shrink-0 text-[10px]">当前</span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 pl-8 text-[10px] text-monokai-comment">
          <Clock className="h-2.5 w-2.5 opacity-70" />
          <span>{formatRelativeTime(session.updatedAt)}</span>
          <span className="opacity-40">·</span>
          <span>{Math.max(0, session.messageCount)} 条</span>
        </div>
        {session.preview && !editing && (
          <p className="copilot-session-row-preview mt-1 truncate pl-8 text-[10px] leading-relaxed">
            {session.preview}
          </p>
        )}
      </button>

      {!editing && (
        <div className="copilot-session-row-actions flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="重命名"
            aria-label={`重命名会话 ${session.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="copilot-session-icon-btn rounded-md p-1.5"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="删除"
            aria-label={`删除会话 ${session.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="copilot-session-icon-btn copilot-session-icon-btn--danger rounded-md p-1.5"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      {editing && (
        <button
          type="button"
          aria-label="确认重命名"
          onClick={(e) => {
            e.stopPropagation();
            commitRename();
          }}
          className="copilot-session-icon-btn copilot-session-icon-btn--ok rounded-md p-1.5"
        >
          <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export const CopilotSessionHistory: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    showSessionHistory,
    setShowSessionHistory,
    createNewSession,
    switchSession,
    renameSession,
    deleteSession,
    isGenerating,
    sessionsHydrated,
  } = useCopilotStore();

  if (!showSessionHistory) return null;

  return (
    <div className="copilot-session-history absolute inset-x-0 top-11 z-40 flex max-h-[min(48vh,380px)] flex-col" aria-label="会话历史">
      <div className="copilot-session-history-header flex h-10 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-wide text-monokai-fg">会话历史</span>
          {sessionsHydrated && (
            <span className="copilot-session-count tabular-nums">{sessions.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void createNewSession()}
            disabled={isGenerating}
            className="copilot-session-action-accent flex items-center gap-1 rounded-md px-2 py-1 text-[11px] disabled:opacity-40"
            aria-label="新建会话"
            title="新建会话"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>新建</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSessionHistory(false)}
            className="copilot-session-icon-btn rounded-md p-1.5"
            aria-label="关闭会话历史"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="copilot-session-history-list custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
        {!sessionsHydrated ? (
          <div className="px-3 py-10 text-center text-[11px] text-monokai-comment">
            正在加载历史会话…
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-10 text-center text-[11px] leading-relaxed text-monokai-comment">
            暂无历史会话。
            <br />
            发送第一条消息后会自动保存。
          </div>
        ) : (
          sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={() => void switchSession(session.id)}
              onRename={(name) => void renameSession(session.id, name)}
              onDelete={() => void deleteSession(session.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CopilotSessionHistory;
