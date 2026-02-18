// User Tutorial Storage Service
// 使用 IndexedDB 存储用户上传的 Markdown 教程

const DB_NAME = 'duckdb_tutorials';
const DB_VERSION = 1;
const STORE_NAME = 'user_tutorials';

export interface UserTutorial {
  id: string;
  title: string;
  content: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  tags: string[];
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
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// 保存用户教程
export const saveUserTutorial = async (tutorial: UserTutorial): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(tutorial);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 获取所有用户教程
export const getAllUserTutorials = async (): Promise<UserTutorial[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

// 根据 ID 获取用户教程
export const getUserTutorialById = async (id: string): Promise<UserTutorial | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 删除用户教程
export const deleteUserTutorial = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 从 Markdown 内容提取标题（第一个 # 标题）
export const extractTitleFromMarkdown = (content: string): string => {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '未命名教程';
};

// 从 Markdown 内容自动判断难度
export const extractDifficultyFromMarkdown = (content: string): UserTutorial['difficulty'] => {
  const lowerContent = content.toLowerCase();
  
  // 检查是否包含高级关键字
  const advancedKeywords = ['高级', '复杂', '优化', '性能', 'partition', 'lateral', '递归', '窗口函数', '向量化'];
  if (advancedKeywords.some(kw => lowerContent.includes(kw))) {
    return 'Advanced';
  }
  
  // 检查是否包含进阶关键字
  const intermediateKeywords = ['进阶', '中级', 'join', '子查询', '视图', '事务', '聚合'];
  if (intermediateKeywords.some(kw => lowerContent.includes(kw))) {
    return 'Intermediate';
  }
  
  // 默认入门级
  return 'Beginner';
};

// 从 Markdown 内容提取分类
export const extractCategoryFromMarkdown = (content: string): string => {
  // 默认归类为"我的教程"
  return '我的教程';
};

// 生成唯一 ID
export const generateTutorialId = (): string => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default {
  saveUserTutorial,
  getAllUserTutorials,
  getUserTutorialById,
  deleteUserTutorial,
  extractTitleFromMarkdown,
  extractDifficultyFromMarkdown,
  extractCategoryFromMarkdown,
  generateTutorialId,
};
