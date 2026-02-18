// Learn Notes Storage Service
// 使用 IndexedDB 存储学习笔记

const DB_NAME = 'duckdb_learn_notes';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

export interface Note {
  id: string;
  tutorialId: string;
  tutorialTitle: string;
  selectedText: string;
  noteContent: string;
  createdAt: string;
  updatedAt: string;
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
      }
    };
  });
};

// 保存笔记
export const saveNote = async (note: Note): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(note);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 获取指定教程的所有笔记
export const getNotesByTutorial = async (tutorialId: string): Promise<Note[]> => {
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

// 获取所有笔记
export const getAllNotes = async (): Promise<Note[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

// 根据 ID 获取笔记
export const getNoteById = async (id: string): Promise<Note | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 删除笔记
export const deleteNote = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 导出所有笔记为 JSON
export const exportNotes = async (): Promise<string> => {
  const notes = await getAllNotes();
  return JSON.stringify(notes, null, 2);
};

// 导入笔记
export const importNotes = async (jsonString: string): Promise<number> => {
  const notes: Note[] = JSON.parse(jsonString);
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let importedCount = 0;
    
    notes.forEach(note => {
      const request = store.put(note);
      request.onsuccess = () => {
        importedCount++;
      };
    });
    
    transaction.oncomplete = () => resolve(importedCount);
    transaction.onerror = () => reject(transaction.error);
  });
};
