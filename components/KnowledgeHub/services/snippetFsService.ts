import { KnowledgeAsset, CodeAsset } from '../types';
import { 
  serializeAssetToMarkdown, 
  parseMarkdownToAsset,
  serializeSnippetToMarkdown, 
  parseMarkdownToSnippet 
} from './snippetMarkdownParser';

const DIRECTORY_HANDLE_KEY = 'duckdb_snippets_dir_handle';
const DB_NAME = 'duckdb_snippets_fs';
const STORE_NAME = 'handles';

// 静态内置的本地 .md 资产 (通过 Vite glob 保证脱机或构建后依然完整立即可用)
const bundledSnippetModules = import.meta.glob('/snippets/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * 获取静态绑定的 .md 资产 (支持代码片段、指标口径、知识笔记)
 */
export function getBundledMarkdownSnippets(): KnowledgeAsset[] {
  const assets: KnowledgeAsset[] = [];
  for (const [filePath, rawContent] of Object.entries(bundledSnippetModules)) {
    const filename = filePath.split('/').pop() || 'snippet.md';
    try {
      const asset = parseMarkdownToAsset(rawContent, filename.replace(/\.md$/, ''));
      assets.push(asset);
    } catch (err) {
      console.warn(`[SnippetFsService] Failed to parse bundled snippet ${filePath}:`, err);
    }
  }
  return assets;
}

/**
 * 尝试通过本地 Vite API 获取磁盘中的 snippets/*.md 文件
 */
export async function fetchSnippetsFromLocalApi(): Promise<KnowledgeAsset[] | null> {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const res = await fetch(`${cleanBase}/api/snippets`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && Array.isArray(data.snippets)) {
      return data.snippets.map((item: { filename: string; content: string }) => {
        return parseMarkdownToAsset(item.content, item.filename.replace(/\.md$/, ''));
      });
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 尝试通过本地 Vite API 获取磁盘 docs/*.md 文件，支持回退到 public/docs/ 发布目录
 */
export async function fetchDocsFromLocalApi(): Promise<{ filename: string; content: string }[] | null> {
  // 1. 尝试直接请求 Vite 开发服务提供的 /api/docs 接口
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const res = await fetch(`${cleanBase}/api/docs`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.docs) && data.docs.length > 0) {
        return data.docs;
      }
    }
  } catch {
    // ignore
  }

  // 2. 回退方案：通过 public/docs/index.json 获取静态发布的讲义文件
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const indexRes = await fetch(`${cleanBase}/docs/index.json`, { signal: AbortSignal.timeout(3000) });
    if (indexRes.ok) {
      const indexData = await indexRes.json();
      if (indexData && Array.isArray(indexData.tutorials)) {
        const results = await Promise.all(
          indexData.tutorials.map(async (t: any) => {
            const rawDocPath = t.docPath || '';
            const cleanDocPath = rawDocPath.startsWith('/') ? rawDocPath : `/${rawDocPath}`;
            const docRes = await fetch(`${cleanBase}${cleanDocPath}`);
            if (docRes.ok) {
              const content = await docRes.text();
              const filename = cleanDocPath.split('/').pop() || `${t.id}.md`;
              return { filename, content };
            }
            return null;
          })
        );
        const valid = results.filter(Boolean) as { filename: string; content: string }[];
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 尝试通过本地 Vite API 保存资产到磁盘 snippets/<filename>.md
 */
export async function saveSnippetToLocalApi(asset: KnowledgeAsset): Promise<boolean> {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const content = serializeAssetToMarkdown(asset);
    const filename = `${asset.id}.md`;
    const res = await fetch(`${cleanBase}/api/snippets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: asset.id, filename, content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 尝试通过本地 Vite API 从磁盘删除 snippets/<filename>.md
 */
export async function deleteSnippetFromLocalApi(id: string): Promise<boolean> {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const res = await fetch(`${cleanBase}/api/snippets?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==================== 浏览器 File System Access API 支持 ====================

/**
 * 打开存储 DirectoryHandle 的 IndexedDB
 */
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 存储选中的本地文件夹句柄
 */
export async function setStoredDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, DIRECTORY_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取已存储的本地文件夹句柄
 */
export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(DIRECTORY_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 弹出原生系统对话框，让用户绑定本地目录（如选择项目下的 snippets 文件夹）
 */
export async function pickLocalSnippetsDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge 浏览器。');
  }
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
    await setStoredDirectoryHandle(handle);
    return handle;
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * 从绑定的本地目录读取所有 .md 资产文件
 */
export async function readSnippetsFromDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<KnowledgeAsset[]> {
  const assets: KnowledgeAsset[] = [];
  for await (const [name, entry] of (handle as any).entries()) {
    if (entry.kind === 'file' && name.endsWith('.md')) {
      const file = await entry.getFile();
      const content = await file.text();
      try {
        const asset = parseMarkdownToAsset(content, name.replace(/\.md$/, ''));
        assets.push(asset);
      } catch (e) {
        console.warn(`[SnippetFsService] Failed to parse ${name}:`, e);
      }
    }
  }
  return assets;
}

/**
 * 向绑定的本地目录写入 .md 资产文件
 */
export async function writeSnippetToDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  asset: KnowledgeAsset
): Promise<void> {
  const filename = `${asset.id}.md`;
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as any).createWritable();
  const mdContent = serializeAssetToMarkdown(asset);
  await writable.write(mdContent);
  await writable.close();
}

/**
 * 从绑定的本地目录删除 .md 资产文件
 */
export async function deleteSnippetFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  id: string
): Promise<void> {
  const filename = `${id}.md`;
  try {
    await handle.removeEntry(filename);
  } catch {
    // 若特定文件名不存在，遍历尝试匹配
    for await (const [name, entry] of (handle as any).entries()) {
      if (entry.kind === 'file' && name.endsWith('.md')) {
        const file = await entry.getFile();
        const content = await file.text();
        if (content.includes(`id: "${id}"`) || content.includes(`id: ${id}`)) {
          await handle.removeEntry(name);
          break;
        }
      }
    }
  }
}
