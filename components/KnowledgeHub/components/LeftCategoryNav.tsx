import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  BookOpen, 
  Upload, 
  Download, 
  FolderCode, 
  FolderOpen, 
  Plus, 
  Sparkles, 
  RotateCcw,
  ChevronDown,
  ChevronRight,
  FileText,
  Database,
  Layers,
  Code2,
  PanelLeftClose
} from 'lucide-react';
import { AssetType, KnowledgeAsset } from '../types';

export interface LeftCategoryNavProps {
  assets: KnowledgeAsset[];
  selectedAssetId?: string | null;
  onSelectAsset?: (id: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // 兼容性接口  selectedCategory?: AssetType | 'all' | 'favorites';
  onSelectCategory?: (cat: AssetType | 'all' | 'favorites') => void;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  onExport: () => void;
  onImport: () => void;
  onImportDocs?: () => void;
  onResetSeeds?: () => void;
  onOpenAiAssistant?: () => void;
  onPickDirectory?: () => void;
  boundDirectoryName?: string | null;
  onNewAsset?: (type: AssetType) => void;
}

/**
 * 依据标题、标签与内容智能映射至知识专题(Topic)，参Org-Museum 真实架构
 */
export function getAssetTopic(asset: KnowledgeAsset): string {
  const title = (asset.type === 'metric' ? asset.name : asset.title).toLowerCase();
  const tags = (asset.tags || []).map((t) => t.toLowerCase());

  if (
    tags.includes('ontology') ||
    tags.includes('本体') ||
    title.includes('本体') ||
    title.includes('ontology')
  ) {
    return 'Ontology';
  }

  if (
    tags.includes('sql') ||
    tags.includes('duckdb') ||
    asset.type === 'code' ||
    title.includes('sql') ||
    title.includes('duckdb')
  ) {
    return 'SQL';
  }

  if (
    tags.includes('tutorial') ||
    tags.includes('course') ||
    title.includes('教程') ||
    title.includes('入门') ||
    title.includes('lesson') ||
    title.includes('讲义')
  ) {
    return 'Tutorials';
  }

  if (
    tags.includes('data') ||
    tags.includes('dataset') ||
    tags.includes('parquet') ||
    title.includes('数据') ||
    title.includes('data') ||
    asset.type === 'metric'
  ) {
    return 'Data';
  }

  return 'General';
}

const LeftCategoryNavInner: React.FC<LeftCategoryNavProps> = ({
  assets,
  selectedAssetId,
  onSelectAsset,
  searchQuery = '',
  onSearchChange,
  isCollapsed = false,
  onToggleCollapse,
  selectedCategory,
  onSelectCategory,
  onExport,
  onImport,
  onImportDocs,
  onResetSeeds,
  onOpenAiAssistant,
  onPickDirectory,
  boundDirectoryName,
  onNewAsset,
}) => {
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});

  // 过滤后的资产列表
  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((a) => {
      // 若处于旧测试环境的分类过滤
  if (selectedCategory && selectedCategory !== 'all') {
        if (selectedCategory === 'favorites') {
          if (!a.isFavorite) return false;
        } else if (a.type !== selectedCategory) {
          return false;
        }
      }

      if (!q) return true;
      const title = (a.type === 'metric' ? a.name : a.title).toLowerCase();
      const desc = (a.type === 'code' ? a.description : a.type === 'note' ? a.summary : a.businessMeaning) || '';
      const tags = (a.tags || []).join(' ').toLowerCase();
      return title.includes(q) || desc.toLowerCase().includes(q) || tags.includes(q);
    });
  }, [assets, searchQuery, selectedCategory]);

  // 按专题分组(参Org-Museum: SQL 04, Ontology 03, Tutorials 02, Data 01...)
  const topicGroups = useMemo(() => {
    const map = new Map<string, KnowledgeAsset[]>();
    // 预置常规顺序
    const order = ['SQL', 'Ontology', 'Tutorials', 'Data', 'General'];
    order.forEach((key) => map.set(key, []));

    filteredAssets.forEach((asset) => {
      const topic = getAssetTopic(asset);
      if (!map.has(topic)) {
        map.set(topic, []);
      }
      map.get(topic)!.push(asset);
    });

    const result: Array<{ topic: string; list: KnowledgeAsset[] }> = [];
    map.forEach((list, topic) => {
      if (list.length > 0) {
        result.push({ topic, list });
      }
    });

    return result;
  }, [filteredAssets]);

  const toggleTopicCollapse = (topic: string) => {
    setCollapsedTopics((prev) => ({
      ...prev,
      [topic]: !prev[topic],
    }));
  };

  const getTopicIcon = (topic: string) => {
    switch (topic) {
      case 'SQL':
        return <Code2 className="w-3.5 h-3.5 text-monokai-accent" />;
      case 'Ontology':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 'Tutorials':
        return <BookOpen className="w-3.5 h-3.5 text-sky-400" />;
      case 'Data':
        return <Database className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-monokai-comment" />;
    }
  };

  // 若已折叠，则不渲染左栏以释放全宽空间
  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      className="w-72 h-full bg-monokai-bg border-r border-monokai-border flex flex-col shrink-0 select-none overflow-hidden"
      aria-label="知识沉淀导航栏"
    >
      {/* 顶部标题与新建入口*/}
      <div className="p-3.5 pb-2 border-b border-monokai-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-monokai-elevated border border-monokai-border flex items-center justify-center text-monokai-accent">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-monokai-fg-muted tracking-wide">知识文献库</h2>
            <span className="text-[10px] text-monokai-comment font-mono">
              {filteredAssets.length} 篇文档 / 讲义
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onNewAsset && (
            <button
              type="button"
              onClick={() => onNewAsset('note')}
              className="flex items-center gap-1 px-2 py-1 rounded bg-monokai-elevated hover:bg-monokai-hover text-monokai-accent text-[11px] font-medium border border-monokai-border transition-colors cursor-pointer"
              title="新建知识笔记"
            >
              <Plus className="w-3 h-3" />
              <span>新建</span>
            </button>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted border border-monokai-border transition-colors cursor-pointer"
              title="折叠隐藏侧边栏"
              aria-label="折叠隐藏侧边栏"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 全局搜索(Org-Museum: 筛选标题 */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-monokai-comment pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="筛选标题或标签... (Ctrl+/)"
            className="w-full pl-8 pr-7 py-1.5 bg-monokai-surface border border-monokai-border rounded-md text-[11.5px] text-monokai-fg-muted placeholder:text-monokai-comment focus:outline-hidden focus:border-monokai-accent/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="absolute right-2 text-monokai-comment hover:text-monokai-fg-muted p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 专题目录树列表*/}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1 space-y-3">
        {topicGroups.length === 0 ? (
          <div className="text-center py-10 px-4 text-monokai-comment text-xs">
            <p>未找到匹配文档</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="mt-2 text-monokai-accent hover:underline text-[11px]"
              >
                清除筛选条件              </button>
            )}
          </div>
        ) : (
          topicGroups.map(({ topic, list }) => {
            const isCollapsed = collapsedTopics[topic];
            const formattedCount = String(list.length).padStart(2, '0');

            return (
              <div key={topic} className="space-y-0.5">
                {/* 专题头部 (例如: SQL 04) */}
                <button
                  type="button"
                  onClick={() => toggleTopicCollapse(topic)}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-surface rounded transition-colors cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-1.5">
                    {getTopicIcon(topic)}
                    <span className="text-xs font-semibold tracking-wide text-monokai-fg-muted group-hover:text-monokai-fg">
                      {topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10.5px]">
                    <span className="font-mono text-monokai-comment px-1 py-0.2 rounded bg-monokai-surface border border-monokai-border">
                      {formattedCount}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-monokai-comment" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-monokai-comment" />
                    )}
                  </div>
                </button>

                {/* 专题下文档条*/}
                {!isCollapsed && (
                  <ul className="pl-2 space-y-0.5 border-l border-monokai-border ml-2.5 my-1">
                    {list.map((asset) => {
                      const isSelected = selectedAssetId === asset.id;
                      const title = asset.type === 'metric' ? asset.name : asset.title;

                      return (
                        <li key={asset.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAsset?.(asset.id);
                              // 兼容旧选择
  if (onSelectCategory && selectedCategory !== 'all') {
                                onSelectCategory('all');
                              }
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11.5px] transition-all flex items-center justify-between group cursor-pointer ${
                              isSelected
                                ? 'bg-monokai-elevated text-monokai-accent font-medium border-l-2 border-monokai-accent shadow-2xs'
                                : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-surface'
                            }`}
                          >
                            <span className="truncate pr-1 leading-snug">{title}</span>
                            {asset.isFavorite && (
                              <span className="text-yellow-400/80 text-[10px] shrink-0">★</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 底部工具条与文档同步入口 */}
      <div className="p-2.5 border-t border-monokai-border bg-monokai-bg space-y-1 text-xs">
        {onImportDocs && (
          <button
            type="button"
            onClick={onImportDocs}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-monokai-elevated hover:bg-monokai-hover text-monokai-accent border border-monokai-border text-[11px] font-medium transition-colors cursor-pointer"
            title="读取本地 docs 目录全部讲义与文档并全量导入"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>载入 docs 目录文档</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={onImport}
            className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted border border-monokai-border text-[10.5px] transition-colors cursor-pointer"
            title="导入本地 Markdown / JSON 知识资产"
          >
            <Upload className="w-3 h-3 text-sky-400" />
            <span>导入 .md</span>
          </button>

          <button
            type="button"
            onClick={onExport}
            className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-monokai-surface hover:bg-monokai-hover text-monokai-comment hover:text-monokai-fg-muted border border-monokai-border text-[10.5px] transition-colors cursor-pointer"
            title="导出全部知识资产为备份文件"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span>导出全部</span>
          </button>
        </div>

        {boundDirectoryName ? (
          <div className="flex items-center justify-between px-2 py-1 bg-monokai-surface border border-monokai-border rounded text-[10px] text-monokai-comment">
            <span className="truncate">已绑定 {boundDirectoryName}</span>
            <button
              type="button"
              onClick={onPickDirectory}
              className="text-monokai-accent hover:underline shrink-0 ml-1"
            >
              更换
            </button>
          </div>
        ) : onPickDirectory ? (
          <button
            type="button"
            onClick={onPickDirectory}
            className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded bg-transparent hover:bg-monokai-surface text-monokai-comment hover:text-monokai-fg-muted text-[10px] transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3 h-3" />
            <span>绑定本地 .md 目录</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
};

export const LeftCategoryNav = React.memo(LeftCategoryNavInner);
