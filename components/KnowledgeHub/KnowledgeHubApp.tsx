import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  KnowledgeAsset, 
  AssetType, 
  CodeAsset, 
  MetricAsset, 
  NoteAsset 
} from './types';
import { 
  getAllKnowledgeAssets, 
  saveKnowledgeAsset, 
  deleteKnowledgeAsset, 
  toggleAssetFavorite, 
  exportKnowledgeAssetsToJson, 
  importKnowledgeAssetsFromJson, 
  importKnowledgeAssetsFromMarkdownFiles,
  importDocsTutorials,
  resetKnowledgeAssetsToSeeds 
} from './services/knowledgeAssetStorage';
import { 
  getStoredDirectoryHandle, 
  pickLocalSnippetsDirectory 
} from './services/snippetFsService';
import { LeftCategoryNav } from './components/LeftCategoryNav';
import { RightDetailWorkbench } from './components/RightDetailWorkbench';
import { AssetEditorModal } from './components/AssetEditorModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { toastService } from '../../services/toastService';

export interface KnowledgeHubAppProps {
  isOpen?: boolean;
  onClose?: () => void;
  onTryCode?: (sql: string) => void;
  onOpenTable?: (tableName: string) => void;
  onNavigateToMetrics?: (metricName: string) => void;
}

export const KnowledgeHubApp: React.FC<KnowledgeHubAppProps> = ({
  onTryCode,
  onOpenTable,
  onNavigateToMetrics,
}) => {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AssetType | 'all' | 'favorites'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [boundDirectoryName, setBoundDirectoryName] = useState<string | null>(null);

  // 侧边栏折叠隐藏状态 (记忆持久化)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('duckdb_knowledge_hub_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('duckdb_knowledge_hub_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Modal 状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<KnowledgeAsset | null>(null);
  const [editorDefaultType, setEditorDefaultType] = useState<AssetType>('code');

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTargetAsset, setAiTargetAsset] = useState<KnowledgeAsset | null>(null);

  // 加载全量资产
  const loadAssets = useCallback(async () => {
    try {
      const data = await getAllKnowledgeAssets();
      setAssets(data);
      if (data.length > 0) {
        setSelectedAssetId((prev) => prev || data[0].id);
      }
    } catch (err: any) {
      console.error('[KnowledgeHub] Failed to load assets:', err);
      toastService.error(`加载资产数据失败: ${err?.message || '未知错误'}`);
    }
  }, []);

  useEffect(() => {
    loadAssets();
    getStoredDirectoryHandle().then((handle) => {
      if (handle) {
        setBoundDirectoryName(handle.name);
      }
    });
  }, [loadAssets]);

  // 支持快捷键 Ctrl+B / Cmd+B 切换侧边栏折叠
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null;
        // 若焦点在可输入组件内部则不抢占
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSidebar]);

  const handlePickDirectory = async () => {
    try {
      const handle = await pickLocalSnippetsDirectory();
      if (handle) {
        setBoundDirectoryName(handle.name);
        await loadAssets();
        toastService.success(`已成功绑定本地代码片段文件夹: ${handle.name}`);
      }
    } catch (err: any) {
      toastService.error(`绑定本地文件夹失败: ${err?.message || '操作取消'}`);
    }
  };

  // 过滤资产列表
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 1. 分类过滤
      if (selectedCategory === 'favorites') {
        if (!asset.isFavorite) return false;
      } else if (selectedCategory !== 'all') {
        if (asset.type !== selectedCategory) return false;
      }

      // 2. 标签过滤
      if (selectedTag) {
        if (!asset.tags || !asset.tags.includes(selectedTag)) return false;
      }

      // 3. 搜索匹配
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTags = asset.tags?.some((t) => t.toLowerCase().includes(q));

        if (asset.type === 'code') {
          const inTitle = asset.title.toLowerCase().includes(q);
          const inDesc = asset.description?.toLowerCase().includes(q);
          const inSql = asset.sql.toLowerCase().includes(q);
          return inTitle || inDesc || inSql || inTags;
        } else if (asset.type === 'metric') {
          const inName = asset.name.toLowerCase().includes(q);
          const inMeaning = asset.businessMeaning?.toLowerCase().includes(q);
          const inFormula = asset.calculationFormula?.toLowerCase().includes(q);
          const inSql = asset.sqlExpression?.toLowerCase().includes(q);
          return inName || inMeaning || inFormula || inSql || inTags;
        } else if (asset.type === 'note') {
          const inTitle = asset.title.toLowerCase().includes(q);
          const inSummary = asset.summary?.toLowerCase().includes(q);
          const inContent = asset.content?.toLowerCase().includes(q);
          return inTitle || inSummary || inContent || inTags;
        }
      }

      return true;
    });
  }, [assets, selectedCategory, selectedTag, searchQuery]);

  // 当过滤列表改变且当前选中项不在列表中时，自动选中第一项
  useEffect(() => {
    if (filteredAssets.length > 0) {
      const isSelectedInFiltered = filteredAssets.some((a) => a.id === selectedAssetId);
      if (!isSelectedInFiltered) {
        setSelectedAssetId(filteredAssets[0].id);
      }
    } else if (assets.length > 0) {
      setSelectedAssetId(null);
    }
  }, [filteredAssets, selectedAssetId, assets.length]);

  // 获取当前选中的资产对象 (带优先首选项 fallback)
  const activeAsset = useMemo(() => {
    if (selectedAssetId) {
      const found = assets.find((a) => a.id === selectedAssetId);
      if (found) return found;
    }
    return filteredAssets.length > 0 ? filteredAssets[0] : assets.length > 0 ? assets[0] : null;
  }, [assets, filteredAssets, selectedAssetId]);

  // 切换收藏
  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const isFav = await toggleAssetFavorite(id);
      setAssets((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isFavorite: isFav } : a))
      );
      toastService.info(isFav ? '已加入收藏' : '已取消收藏');
    } catch (err: any) {
      toastService.error(`收藏失败: ${err?.message}`);
    }
  };

  // 新建资产
  const handleOpenNewModal = (type: AssetType) => {
    setAssetToEdit(null);
    setEditorDefaultType(type);
    setIsEditorOpen(true);
  };

  // 编辑资产
  const handleOpenEditModal = (asset: KnowledgeAsset) => {
    setAssetToEdit(asset);
    setIsEditorOpen(true);
  };

  // 保存资产 (新增或修改)
  const handleSaveAsset = async (asset: KnowledgeAsset) => {
    try {
      await saveKnowledgeAsset(asset);
      await loadAssets();
      setSelectedAssetId(asset.id);
      toastService.success(`知识资产「${asset.type === 'metric' ? asset.name : asset.title}」已保存`);
    } catch (err: any) {
      toastService.error(`保存资产失败: ${err?.message}`);
    }
  };

  // 删除资产
  const handleDeleteAsset = async (id: string) => {
    const asset = assets.find((a) => a.id === id);
    const title = asset ? (asset.type === 'metric' ? asset.name : asset.title) : '此资产';
    if (!window.confirm(`确定要彻底删除「${title}」吗？`)) {
      return;
    }

    try {
      await deleteKnowledgeAsset(id);
      const remaining = assets.filter((a) => a.id !== id);
      setAssets(remaining);
      if (selectedAssetId === id) {
        setSelectedAssetId(remaining.length > 0 ? remaining[0].id : null);
      }
      toastService.success(`已成功删除资产「${title}」`);
    } catch (err: any) {
      toastService.error(`删除失败: ${err?.message}`);
    }
  };

  // 更新笔记正文
  const handleUpdateNoteContent = async (id: string, newContent: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.type !== 'note') return;
    try {
      const updated: NoteAsset = {
        ...asset,
        content: newContent,
      };
      await saveKnowledgeAsset(updated);
      setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toastService.success('笔记内容已自动保存');
    } catch (err: any) {
      toastService.error(`保存笔记失败: ${err?.message}`);
    }
  };

  // 导出全部资产
  const handleExport = async () => {
    try {
      const json = await exportKnowledgeAssetsToJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duckdb-knowledge-assets-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastService.success(`已导出 ${assets.length} 项知识资产备份`);
    } catch (err: any) {
      toastService.error(`导出失败: ${err?.message}`);
    }
  };

  // 导入资产 (支持 .json, .md, .markdown 批量多选导入)
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.markdown,text/markdown,application/json';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files: File[] = Array.from(e.target?.files || []);
      if (files.length === 0) return;

      try {
        let addedCount = 0;
        let updatedCount = 0;

        const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'));
        const mdFiles = files.filter(
          (f) => f.name.toLowerCase().endsWith('.md') || f.name.toLowerCase().endsWith('.markdown')
        );

        // 处理 JSON 资产包
  for (const jf of jsonFiles) {
          const text = await jf.text();
          const res = await importKnowledgeAssetsFromJson(text);
          addedCount += res.added;
          updatedCount += res.updated;
        }

        // 处理 Markdown 文档/片段
        if (mdFiles.length > 0) {
          const mdContents = await Promise.all(
            mdFiles.map(async (f) => ({
              filename: f.name,
              content: await f.text(),
            }))
          );
          const res = await importKnowledgeAssetsFromMarkdownFiles(mdContents);
          addedCount += res.added;
          updatedCount += res.updated;
        }

        await loadAssets();
        toastService.success(
          `导入成功：共处理 ${files.length} 个文件（新增 ${addedCount} 项，更新 ${updatedCount} 项）`
        );
      } catch (err: any) {
        console.error('[KnowledgeHub] Import error:', err);
        toastService.error(`导入失败: ${err?.message || '文件格式不符'}`);
      }
    };
    input.click();
  };

  // 一键导入 docs 目录下的教程文档
  const handleImportDocsDirectory = async () => {
    try {
      toastService.info('正在从 docs 目录载入教程文档...');
      const res = await importDocsTutorials();
      await loadAssets();
      if (res.assets.length > 0) {
        setSelectedAssetId(res.assets[0].id);
      }
      toastService.success(
        `已成功载入 docs 目录下的 ${res.total} 篇教程文档（新增 ${res.added} 篇，更新 ${res.updated} 篇）！`
      );
    } catch (err: any) {
      console.error('[KnowledgeHub] Failed to import docs directory:', err);
      toastService.error(`载入 docs 文档失败: ${err?.message || '请检查服务端连接'}`);
    }
  };

  // 重置回预置种子
  const handleResetSeeds = async () => {
    if (!window.confirm('重置将清除所有自建资产并恢复初始内置资产，是否继续？')) {
      return;
    }
    try {
      await resetKnowledgeAssetsToSeeds();
      await loadAssets();
      toastService.success('已重置为初始内置知识资产');
    } catch (err: any) {
      toastService.error(`重置失败: ${err?.message}`);
    }
  };

  return (
    <div className="w-full h-full flex overflow-hidden bg-monokai-bg select-text">
      {/* 左栏：Org-Museum 风格专题导航与文档树 */}
      <LeftCategoryNav
        assets={assets}
        selectedAssetId={selectedAssetId}
        onSelectAsset={(id) => setSelectedAssetId(id)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedTag(null);
        }}
        selectedTag={selectedTag}
        onSelectTag={(tag) => setSelectedTag(tag)}
        onExport={handleExport}
        onImport={handleImport}
        onImportDocs={handleImportDocsDirectory}
        onResetSeeds={handleResetSeeds}
        onPickDirectory={handlePickDirectory}
        boundDirectoryName={boundDirectoryName}
        onNewAsset={handleOpenNewModal}
        onOpenAiAssistant={() => {
          setAiTargetAsset(null);
          setIsAiModalOpen(true);
        }}
      />

      {/* 右栏：沉浸式工作台主面板 (全宽阅读与交互) */}
      <RightDetailWorkbench
        asset={activeAsset}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        onTryCode={onTryCode}
        onNavigateToMetrics={onNavigateToMetrics}
        onToggleFavorite={handleToggleFavorite}
        onEditAsset={handleOpenEditModal}
        onDeleteAsset={handleDeleteAsset}
        onUpdateNoteContent={handleUpdateNoteContent}
        onOpenAiAssistant={(asset) => {
          setAiTargetAsset(asset || null);
          setIsAiModalOpen(true);
        }}
      />

      {/* 新增/编辑 Modal */}
      <AssetEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        assetToEdit={assetToEdit}
        defaultType={editorDefaultType}
        onSave={handleSaveAsset}
      />

      {/* AI 智能提炼 Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        targetAsset={aiTargetAsset}
        onSaveExtractedAsset={handleSaveAsset}
      />
    </div>
  );
};

export default KnowledgeHubApp;
