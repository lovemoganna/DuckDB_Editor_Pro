// Code Snippets Storage Service
// 使用 IndexedDB 存储用户收藏的代码片段

const DB_NAME = 'duckdb_code_snippets';
const DB_VERSION = 1;
const STORE_NAME = 'snippets';

export interface CodeSnippet {
  id: string;
  code: string;
  description: string;
  tutorialId: string;
  tutorialTitle: string;
  tags: string[];
  createdAt: string;
}

// 打开 IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('tutorialId', 'tutorialId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
    };
  });
};

// 保存代码片段
export const saveSnippet = async (snippet: CodeSnippet): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snippet);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 获取所有代码片段
export const getAllSnippets = async (): Promise<CodeSnippet[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result || [];
      // 按创建时间倒序排列
      result.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(result);
    };
  });
};

// 根据 ID 获取代码片段
export const getSnippetById = async (id: string): Promise<CodeSnippet | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 根据教程 ID 获取代码片段
export const getSnippetsByTutorial = async (tutorialId: string): Promise<CodeSnippet[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('tutorialId');
    const request = index.getAll(tutorialId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

// 根据标签获取代码片段
export const getSnippetsByTag = async (tag: string): Promise<CodeSnippet[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = (request.result || []).filter(snippet =>
        snippet.tags.includes(tag)
      );
      resolve(result);
    };
  });
};

// 删除代码片段
export const deleteSnippet = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 检查代码是否已收藏
export const isSnippetExists = async (code: string): Promise<CodeSnippet | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = (request.result || []).find(snippet =>
        snippet.code.trim() === code.trim()
      );
      resolve(result);
    };
  });
};

// 搜索代码片段
export const searchSnippets = async (query: string): Promise<CodeSnippet[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const lowerQuery = query.toLowerCase();
      const result = (request.result || []).filter(snippet =>
        snippet.code.toLowerCase().includes(lowerQuery) ||
        snippet.description.toLowerCase().includes(lowerQuery) ||
        snippet.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
      resolve(result);
    };
  });
};

// 获取所有标签
export const getAllTags = async (): Promise<string[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tagSet = new Set<string>();
      (request.result || []).forEach(snippet => {
        snippet.tags.forEach(tag => tagSet.add(tag));
      });
      resolve(Array.from(tagSet).sort());
    };
  });
};

// 获取收藏数量
export const getSnippetsCount = async (): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 生成唯一 ID
export const generateSnippetId = (): string => {
  return `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default {
  saveSnippet,
  getAllSnippets,
  getSnippetById,
  getSnippetsByTutorial,
  getSnippetsByTag,
  deleteSnippet,
  isSnippetExists,
  searchSnippets,
  getAllTags,
  getSnippetsCount,
  generateSnippetId,
};
