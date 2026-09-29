/**
 * copilotSessionStorage — IndexedDB persistence for AI Copilot multi-session history.
 *
 * Keeps Copilot threads durable across reloads without mixing Abstraction AISession shapes.
 */

import { closeDatabaseOnVersionChange } from './indexedDBLifecycle';

const DB_NAME = 'duckdb_copilot_sessions';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const ACTIVE_SESSION_KEY = 'copilot_active_session_id';
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 200;

export interface CopilotStoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sqlBlocks?: string[];
  model?: string;
  error?: boolean;
}

export interface CopilotSession {
  id: string;
  name: string;
  messages: CopilotStoredMessage[];
  contextTables: string[];
  contextTable: string | null;
  selectedModel?: string;
  createdAt: number;
  updatedAt: number;
}

export type CopilotSessionMeta = Pick<CopilotSession, 'id' | 'name' | 'createdAt' | 'updatedAt'> & {
  messageCount: number;
  preview: string;
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(closeDatabaseOnVersionChange(request.result));
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

const generateId = (): string =>
  `cps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Strip ephemeral streaming flags before persistence. */
export function sanitizeMessagesForStorage(
  messages: Array<CopilotStoredMessage & { isStreaming?: boolean }>,
): CopilotStoredMessage[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map(({ isStreaming: _drop, ...rest }) => rest)
    .slice(-MAX_MESSAGES_PER_SESSION);
}

export function toSessionMeta(session: CopilotSession): CopilotSessionMeta {
  const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
  const lastAny = session.messages[session.messages.length - 1];
  const previewSource = lastUser?.content || lastAny?.content || '';
  return {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    preview: previewSource.replace(/\s+/g, ' ').trim().slice(0, 72),
  };
}

export function deriveSessionTitle(
  messages: Array<{ role: string; content: string }>,
  fallback = '新对话',
): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!firstUser) return fallback;
  const text = firstUser.content.replace(/\s+/g, ' ').trim();
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

export function getActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setActiveSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
    else localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export async function listCopilotSessions(): Promise<CopilotSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const sessions = (request.result as CopilotSession[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listCopilotSessionMetas(): Promise<CopilotSessionMeta[]> {
  const sessions = await listCopilotSessions();
  return sessions.map(toSessionMeta);
}

export async function getCopilotSession(id: string): Promise<CopilotSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as CopilotSession) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function createCopilotSession(
  partial?: Partial<Pick<CopilotSession, 'name' | 'messages' | 'contextTables' | 'contextTable' | 'selectedModel'>>,
): Promise<CopilotSession> {
  const now = Date.now();
  const messages = sanitizeMessagesForStorage(partial?.messages || []);
  const session: CopilotSession = {
    id: generateId(),
    name: partial?.name || deriveSessionTitle(messages, '新对话'),
    messages,
    contextTables: partial?.contextTables || [],
    contextTable: partial?.contextTable ?? null,
    selectedModel: partial?.selectedModel,
    createdAt: now,
    updatedAt: now,
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).add(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  await pruneOldSessions();
  setActiveSessionId(session.id);
  return session;
}

export async function saveCopilotSession(session: CopilotSession): Promise<CopilotSession> {
  const updated: CopilotSession = {
    ...session,
    messages: sanitizeMessagesForStorage(session.messages),
    name: session.name || deriveSessionTitle(session.messages),
    updatedAt: Date.now(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(updated);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return updated;
}

export async function deleteCopilotSession(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  if (getActiveSessionId() === id) {
    setActiveSessionId(null);
  }
}

export async function renameCopilotSession(id: string, name: string): Promise<CopilotSession | null> {
  const existing = await getCopilotSession(id);
  if (!existing) return null;
  return saveCopilotSession({ ...existing, name: name.trim() || existing.name });
}

async function pruneOldSessions(): Promise<void> {
  const sessions = await listCopilotSessions();
  if (sessions.length <= MAX_SESSIONS) return;
  const toDelete = sessions.slice(MAX_SESSIONS);
  await Promise.all(toDelete.map((s) => deleteCopilotSession(s.id)));
}
