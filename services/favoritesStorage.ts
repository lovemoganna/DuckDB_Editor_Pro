// Favorites Storage Service
// 使用 IndexedDB 存储用户收藏的教程

const DB_NAME = 'duckdb_learn_favorites';
const DB_VERSION = 1;
const STORE_NAME = 'favorites';

export interface Favorite {
  id: string;
  tutorialId: string;
  tutorialTitle: string;
  tutorialCategory?: string;
  addedAt: string;
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
        store.createIndex('tutorialId', 'tutorialId', { unique: true });
        store.createIndex('addedAt', 'addedAt', { unique: false });
      }
    };
  });
};

// 添加收藏
export const addFavorite = async (favorite: Favorite): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(favorite);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 移除收藏
export const removeFavorite = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 移除收藏 by tutorialId
export const removeFavoriteByTutorialId = async (tutorialId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('tutorialId');
    const request = index.get(tutorialId);

    request.onsuccess = () => {
      if (request.result) {
        store.delete(request.result.id);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// 获取所有收藏
export const getAllFavorites = async (): Promise<Favorite[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result || [];
      // 按添加时间倒序排列
      result.sort((a, b) => 
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
      resolve(result);
    };
  });
};

// 检查是否已收藏
export const isFavorite = async (tutorialId: string): Promise<boolean> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('tutorialId');
    const request = index.get(tutorialId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(!!request.result);
  });
};

// 获取收藏数量
export const getFavoritesCount = async (): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};
