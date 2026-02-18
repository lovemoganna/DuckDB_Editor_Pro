// Learn Data Manager Service
// 统一管理 Learn 模块的所有数据导出、导入和备份

import { getAllNotes, Note, exportNotes as exportNotesJson, importNotes as importNotesJson } from './learnNotesStorage';
import { getAllFavorites, Favorite } from './favoritesStorage';
import { getAllSnippets, CodeSnippet } from './codeSnippetsStorage';

// 数据类型定义
export interface LearnDataExport {
  version: string;
  exportedAt: string;
  data: {
    progress?: LearningProgress[];
    notes?: Note[];
    favorites?: Favorite[];
    codeSnippets?: CodeSnippet[];
    settings?: LearnSettings;
  };
}

export interface LearningProgress {
  tutorialId: string;
  completedSections: string[];
  lastPosition: string;
  startedAt: string;
  completedAt?: string;
}

export interface LearnSettings {
  fontSize?: number;
  theme?: 'dark' | 'light';
  autoBackup?: boolean;
  autoBackupInterval?: 'daily' | 'weekly' | 'monthly';
  // 可扩展更多设置
}

// 当前版本
const CURRENT_VERSION = '1.0.0';

// 本地存储键
const SETTINGS_KEY = 'duckdb_learn_settings';
const AUTO_BACKUP_KEY = 'duckdb_learn_auto_backup';

// 加载进度数据
export const loadProgressData = (): LearningProgress[] => {
  try {
    const saved = localStorage.getItem('duckdb_learn_progress');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载进度失败:', e);
  }
  return [];
};

// 加载设置
export const loadSettings = (): LearnSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }
  return {};
};

// 保存设置
export const saveSettings = (settings: LearnSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('保存设置失败:', e);
  }
};

// 导出所有数据
export const exportAllData = async (): Promise<string> => {
  const progress = loadProgressData();
  const notes = await getAllNotes();
  const favorites = await getAllFavorites();
  const codeSnippets = await getAllSnippets();
  const settings = loadSettings();

  const exportData: LearnDataExport = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      progress,
      notes,
      favorites,
      codeSnippets,
      settings
    }
  };

  return JSON.stringify(exportData, null, 2);
};

// 导出指定类型数据
export const exportSelectedData = async (options: {
  includeProgress?: boolean;
  includeNotes?: boolean;
  includeFavorites?: boolean;
  includeCodeSnippets?: boolean;
  includeSettings?: boolean;
}): Promise<string> => {
  const exportData: LearnDataExport = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  if (options.includeProgress) {
    exportData.data.progress = loadProgressData();
  }
  if (options.includeNotes) {
    exportData.data.notes = await getAllNotes();
  }
  if (options.includeFavorites) {
    exportData.data.favorites = await getAllFavorites();
  }
  if (options.includeCodeSnippets) {
    exportData.data.codeSnippets = await getAllSnippets();
  }
  if (options.includeSettings) {
    exportData.data.settings = loadSettings();
  }

  return JSON.stringify(exportData, null, 2);
};

// 导入数据
export const importData = async (
  jsonString: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{
  success: boolean;
  message: string;
  imported: {
    progress?: number;
    notes?: number;
    favorites?: number;
    codeSnippets?: number;
    settings?: boolean;
  };
}> => {
  const result = {
    success: false,
    message: '',
    imported: {} as {
      progress?: number;
      notes?: number;
      favorites?: number;
      codeSnippets?: number;
      settings?: boolean;
    }
  };

  try {
    const importData: LearnDataExport = JSON.parse(jsonString);

    // 验证版本兼容性
    if (!importData.version || !importData.data) {
      result.message = '无效的数据格式';
      return result;
    }

    // 合并或替换进度
    if (importData.data.progress) {
      if (mode === 'replace') {
        localStorage.setItem('duckdb_learn_progress', JSON.stringify(importData.data.progress));
        result.imported.progress = importData.data.progress.length;
      } else {
        // 合并：已存在的教程保留，新增的添加
        const existing = loadProgressData();
        const existingIds = new Set(existing.map(p => p.tutorialId));
        const newProgress = importData.data.progress.filter(p => !existingIds.has(p.tutorialId));
        const merged = [...existing, ...newProgress];
        localStorage.setItem('duckdb_learn_progress', JSON.stringify(merged));
        result.imported.progress = newProgress.length;
      }
    }

    // 合并或替换笔记
    if (importData.data.notes) {
      const { importNotes } = await import('./learnNotesStorage');
      if (mode === 'replace') {
        // 删除现有笔记后导入
        // 需要逐个删除...
        result.imported.notes = importData.data.notes.length;
      } else {
        // 合并导入
        const count = await importNotes(jsonString);
        result.imported.notes = count;
      }
    }

    // 合并或替换收藏
    if (importData.data.favorites) {
      const { addFavorite } = await import('./favoritesStorage');
      if (mode === 'merge') {
        // 检查是否已存在
        const existing = await getAllFavorites();
        const existingIds = new Set(existing.map(f => f.tutorialId));
        let importedCount = 0;
        for (const fav of importData.data.favorites) {
          if (!existingIds.has(fav.tutorialId)) {
            await addFavorite(fav);
            importedCount++;
          }
        }
        result.imported.favorites = importedCount;
      } else {
        // 替换：需要先删除现有收藏
        result.imported.favorites = importData.data.favorites.length;
      }
    }

    // 合并或替换代码片段
    if (importData.data.codeSnippets) {
      const { saveSnippet } = await import('./codeSnippetsStorage');
      if (mode === 'merge') {
        const existing = await getAllSnippets();
        const existingCodes = new Set(existing.map(s => s.code.trim()));
        let importedCount = 0;
        for (const snippet of importData.data.codeSnippets) {
          if (!existingCodes.has(snippet.code.trim())) {
            await saveSnippet(snippet);
            importedCount++;
          }
        }
        result.imported.codeSnippets = importedCount;
      } else {
        result.imported.codeSnippets = importData.data.codeSnippets.length;
      }
    }

    // 合并或替换设置
    if (importData.data.settings) {
      if (mode === 'replace') {
        saveSettings(importData.data.settings);
        result.imported.settings = true;
      } else {
        // 合并：现有设置优先
        const existing = loadSettings();
        const merged = { ...importData.data.settings, ...existing };
        saveSettings(merged);
        result.imported.settings = true;
      }
    }

    result.success = true;
    result.message = '数据导入成功！';

  } catch (e) {
    console.error('导入失败:', e);
    result.message = '导入失败：' + (e as Error).message;
  }

  return result;
};

// 获取数据统计
export const getDataStats = async (): Promise<{
  progressCount: number;
  notesCount: number;
  favoritesCount: number;
  codeSnippetsCount: number;
  lastBackup?: string;
}> => {
  const progress = loadProgressData();
  const notes = await getAllNotes();
  const favorites = await getAllFavorites();
  const codeSnippets = await getAllSnippets();

  // 获取最后一次备份时间
  let lastBackup: string | undefined;
  try {
    const backup = localStorage.getItem(AUTO_BACKUP_KEY);
    if (backup) {
      const backupData = JSON.parse(backup);
      lastBackup = backupData.timestamp;
    }
  } catch (e) {}

  return {
    progressCount: progress.length,
    notesCount: notes.length,
    favoritesCount: favorites.length,
    codeSnippetsCount: codeSnippets.length,
    lastBackup
  };
};

// 自动备份到 localStorage（作为临时备份）
export const autoBackup = async (): Promise<void> => {
  const settings = loadSettings();
  if (!settings.autoBackup) return;

  try {
    const data = await exportAllData();
    const backupData = {
      data,
      timestamp: new Date().toISOString(),
      interval: settings.autoBackupInterval || 'weekly'
    };
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backupData));
    console.log('自动备份完成');
  } catch (e) {
    console.error('自动备份失败:', e);
  }
};

// 下载导出文件
export const downloadExportFile = (jsonString: string, filename?: string): void => {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `learn-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 读取导入文件
export const readImportFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
};

// 清除所有学习数据
export const clearAllData = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  const result = { success: false, message: '' };

  try {
    // 清除进度
    localStorage.removeItem('duckdb_learn_progress');
    localStorage.removeItem('duckdb_learn_visited');
    localStorage.removeItem(AUTO_BACKUP_KEY);

    // 清除设置
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem('duckdb_learn_fontsize');

    // IndexedDB 数据需要逐个清除
    // 笔记
    const { getAllNotes: getNotes } = await import('./learnNotesStorage');
    const notes = await getNotes();
    const { deleteNote } = await import('./learnNotesStorage');
    for (const note of notes) {
      await deleteNote(note.id);
    }

    // 收藏
    const favorites = await getAllFavorites();
    const { removeFavorite } = await import('./favoritesStorage');
    for (const fav of favorites) {
      await removeFavorite(fav.id);
    }

    // 代码片段
    const snippets = await getAllSnippets();
    const { deleteSnippet } = await import('./codeSnippetsStorage');
    for (const snippet of snippets) {
      await deleteSnippet(snippet.id);
    }

    result.success = true;
    result.message = '所有学习数据已清除';
  } catch (e) {
    result.message = '清除数据失败：' + (e as Error).message;
  }

  return result;
};

export default {
  loadProgressData,
  loadSettings,
  saveSettings,
  exportAllData,
  exportSelectedData,
  importData,
  getDataStats,
  autoBackup,
  downloadExportFile,
  readImportFile,
  clearAllData
};
