/**
 * knowledgeAssetStorage.ts
 * 统一知识资产持久化存储服务 (IndexedDB)
 */

import { KnowledgeAsset, AssetType, CodeAsset } from '../types';
import { SEED_KNOWLEDGE_ASSETS } from '../data/seedAssets';
import { closeDatabaseOnVersionChange } from '../../../services/indexedDBLifecycle';
import {
  fetchSnippetsFromLocalApi,
  fetchDocsFromLocalApi,
  saveSnippetToLocalApi,
  deleteSnippetFromLocalApi,
  getBundledMarkdownSnippets,
  getStoredDirectoryHandle,
  readSnippetsFromDirectoryHandle,
  writeSnippetToDirectoryHandle,
  deleteSnippetFromDirectoryHandle,
} from './snippetFsService';
import { parseMarkdownToAsset } from './snippetMarkdownParser';

const DB_NAME = 'duckdb_knowledge_hub';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in current environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(closeDatabaseOnVersionChange(request.result));

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      }
    };
  });
};

/**
 * 获取全部资产（同步加载磁盘指定目录下的 .md 片段文件与 IndexedDB 资产）
 */
export const getAllKnowledgeAssets = async (): Promise<KnowledgeAsset[]> => {
  try {
    const db = await openDB();
    const assets = await new Promise<KnowledgeAsset[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // 1. 同步加载本地磁盘中的 snippets/*.md 文件
    let diskSnippets: KnowledgeAsset[] | null = null;

    // 尝试 A: 浏览器已授权绑定的本地目录
    const dirHandle = await getStoredDirectoryHandle();
    if (dirHandle) {
      try {
        diskSnippets = await readSnippetsFromDirectoryHandle(dirHandle);
      } catch (e) {
        console.warn('[KnowledgeAssetStorage] Error reading from bound directory handle:', e);
      }
    }

    // 尝试 B: 通过 Vite 本地文件系统 API (snippets/*.md)
    if (!diskSnippets || diskSnippets.length === 0) {
      diskSnippets = await fetchSnippetsFromLocalApi();
    }

    // 尝试 C: 静态绑定的 .md 片段文件
    if (!diskSnippets || diskSnippets.length === 0) {
      const bundled = getBundledMarkdownSnippets();
      if (bundled.length > 0) {
        diskSnippets = bundled;
      }
    }

    // 合并磁盘中的 .md 片段到当前资产列表
    const assetMap = new Map<string, KnowledgeAsset>();

    // 先填入 IndexedDB 或 SEED 数据
    const baseList = assets.length === 0 ? SEED_KNOWLEDGE_ASSETS : assets;
    baseList.forEach((a) => assetMap.set(a.id, a));

    // 用磁盘 .md 文件覆盖或新增
    if (diskSnippets && diskSnippets.length > 0) {
      diskSnippets.forEach((snippet) => {
        const existing = assetMap.get(snippet.id);
        if (existing) {
          assetMap.set(snippet.id, {
            ...existing,
            ...snippet,
            isFavorite: existing.isFavorite ?? snippet.isFavorite,
          });
        } else {
          assetMap.set(snippet.id, snippet);
        }
      });
    }

    const merged = Array.from(assetMap.values());

    if (assets.length === 0) {
      await saveMultipleAssets(merged);
    }

    // 按更新时间倒序排序
    return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.warn('[KnowledgeAssetStorage] Error loading assets, falling back to seed data:', err);
    return SEED_KNOWLEDGE_ASSETS;
  }
};

/**
 * 根据 ID 查询单项资产
 */
export const getKnowledgeAssetById = async (id: string): Promise<KnowledgeAsset | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[KnowledgeAssetStorage] Error getting asset ${id}:`, err);
    return null;
  }
};

/**
 * 保存或更新单项资产（同时写入 IndexedDB 与磁盘 snippets/*.md 文件）
 */
export const saveKnowledgeAsset = async (asset: KnowledgeAsset): Promise<void> => {
  const db = await openDB();
  const updated: KnowledgeAsset = {
    ...asset,
    updatedAt: new Date().toISOString(),
    createdAt: asset.createdAt || new Date().toISOString(),
  };

  // 1. 写入 IndexedDB
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 2. 持久化保存到磁盘 .md 文件 (支持 code / metric / note 全资产)
  saveSnippetToLocalApi(updated).catch(() => {});

  // 如果浏览器通过 File System Access API 绑定了本地文件夹，同时写入
  getStoredDirectoryHandle()
    .then((handle) => {
      if (handle) {
        writeSnippetToDirectoryHandle(handle, updated).catch((e) =>
          console.warn('[KnowledgeAssetStorage] Failed writing to directory handle:', e)
        );
      }
    })
    .catch(() => {});
};

/**
 * 批量写入资产
 */
export const saveMultipleAssets = async (assets: KnowledgeAsset[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    assets.forEach((asset) => {
      store.put(asset);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * 删除资产（同时从 IndexedDB 与磁盘 snippets/*.md 文件中删除）
 */
export const deleteKnowledgeAsset = async (id: string): Promise<void> => {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 同步从本地磁盘删除对应 .md 文件
  deleteSnippetFromLocalApi(id).catch(() => {});

  getStoredDirectoryHandle()
    .then((handle) => {
      if (handle) {
        deleteSnippetFromDirectoryHandle(handle, id).catch(() => {});
      }
    })
    .catch(() => {});
};

/**
 * 切换收藏状态
 */
export const toggleAssetFavorite = async (id: string): Promise<boolean> => {
  const asset = await getKnowledgeAssetById(id);
  if (!asset) return false;
  const newFav = !asset.isFavorite;
  await saveKnowledgeAsset({
    ...asset,
    isFavorite: newFav,
  });
  return newFav;
};

/**
 * 导出全量资产为 JSON
 */
export const exportKnowledgeAssetsToJson = async (): Promise<string> => {
  const assets = await getAllKnowledgeAssets();
  return JSON.stringify(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      assetCount: assets.length,
      assets,
    },
    null,
    2
  );
};

/**
 * 导入资产 JSON 数据
 */
export const importKnowledgeAssetsFromJson = async (
  jsonString: string
): Promise<{ total: number; added: number; updated: number }> => {
  const data = JSON.parse(jsonString);
  const rawList: KnowledgeAsset[] = Array.isArray(data) ? data : data.assets;
  if (!Array.isArray(rawList)) {
    throw new Error('无效的导入数据格式，未找到资产列表。');
  }

  const existing = await getAllKnowledgeAssets();
  const existingMap = new Map(existing.map((a) => [a.id, a]));

  let added = 0;
  let updated = 0;
  const validAssets: KnowledgeAsset[] = [];

  for (const item of rawList) {
    if (!item.id || !item.type || !item.tags) continue;
    if (existingMap.has(item.id)) {
      updated++;
    } else {
      added++;
    }
    validAssets.push({
      ...item,
      updatedAt: new Date().toISOString(),
    });
  }

  await saveMultipleAssets(validAssets);
  return { total: validAssets.length, added, updated };
};

/**
 * 批量导入 Markdown 格式文档/片段文件
 */
export const importKnowledgeAssetsFromMarkdownFiles = async (
  files: { filename: string; content: string }[]
): Promise<{ total: number; added: number; updated: number; assets: KnowledgeAsset[] }> => {
  if (!Array.isArray(files) || files.length === 0) {
    return { total: 0, added: 0, updated: 0, assets: [] };
  }

  const existing = await getAllKnowledgeAssets();
  const existingMap = new Map(existing.map((a) => [a.id, a]));

  let added = 0;
  let updated = 0;
  const parsedAssets: KnowledgeAsset[] = [];

  for (const file of files) {
    if (!file.content || !file.content.trim()) continue;
    const cleanId = file.filename.replace(/\.md$/, '').trim();
    const asset = parseMarkdownToAsset(file.content, cleanId);

    if (existingMap.has(asset.id)) {
      updated++;
    } else {
      added++;
    }

    parsedAssets.push(asset);
  }

  if (parsedAssets.length > 0) {
    await saveMultipleAssets(parsedAssets);

    // 尝试异步同步回本地磁盘 API (如果正在运行本地 Vite 服务)
    for (const asset of parsedAssets) {
      saveSnippetToLocalApi(asset).catch(() => {});
    }
  }

  return { total: parsedAssets.length, added, updated, assets: parsedAssets };
};

/**
 * 一键导入或同步 docs 目录下的全量技术教程文档
 */
export const importDocsTutorials = async (): Promise<{
  total: number;
  added: number;
  updated: number;
  assets: KnowledgeAsset[];
}> => {
  const docs = await fetchDocsFromLocalApi();
  if (!docs || docs.length === 0) {
    throw new Error('未在 docs 目录检测到 Markdown 教程文件，或本地服务端未返回文档数据。');
  }

  return await importKnowledgeAssetsFromMarkdownFiles(docs);
};

/**
 * 重置回初始内置种子资产
 */
export const resetKnowledgeAssetsToSeeds = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    SEED_KNOWLEDGE_ASSETS.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
