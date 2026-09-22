import React, { useState } from 'react';
import { 
  Search, 
  X, 
  Plus, 
  Code2, 
  Target, 
  BookMarked, 
  Star, 
  Calendar,
  ChevronDown
} from 'lucide-react';
import { KnowledgeAsset, AssetType } from '../types';

interface MiddleAssetListProps {
  assets: KnowledgeAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onNewAsset: (type: AssetType) => void;
}

export const MiddleAssetList: React.FC<MiddleAssetListProps> = ({
  assets,
  selectedAssetId,
  onSelectAsset,
  searchQuery,
  onSearchChange,
  onToggleFavorite,
  onNewAsset,
}) => {
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  const getAssetMeta = (asset: KnowledgeAsset) => {
    switch (asset.type) {
      case 'code':
        return {
          badgeText: asset.category === 'template' ? 'SQL模版' : asset.category === 'script' ? '脚本' : '代码片段',
          badgeClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
          icon: Code2,
          snippet: asset.description,
        };
      case 'metric':
        return {
          badgeText: '业务口径',
          badgeClass: 'bg-sky-950/60 text-sky-400 border-sky-800/40',
          icon: Target,
          snippet: asset.businessMeaning,
        };
      case 'note':
        return {
          badgeText: asset.topic === 'pitfall' ? '避坑指南' : asset.topic === 'optimization' ? '性能优化' : '经验笔记',
          badgeClass: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
          icon: BookMarked,
          snippet: asset.summary,
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full bg-monokai-surface border-r border-monokai-border">
      {/* 搜索与新建栏 */}
      <div className="p-3 border-b border-monokai-border flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* 即时搜索*/}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-monokai-comment absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索标题、标签或内容..."
              className="w-full bg-monokai-bg border border-monokai-border text-monokai-fg-muted text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-monokai-accent transition-colors placeholder:text-monokai-comment"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 新建资产下拉按钮 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
              className="flex items-center gap-1 bg-monokai-accent hover:bg-monokai-accent-hover text-monokai-bg px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>新建</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {isNewMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsNewMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-36 bg-monokai-elevated border border-monokai-border rounded-lg shadow-xl py-1 z-30 flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onNewAsset('code');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-monokai-fg-muted hover:bg-monokai-border hover:text-emerald-400 text-left transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>新建代码片段</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onNewAsset('metric');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-monokai-fg-muted hover:bg-monokai-border hover:text-sky-400 text-left transition-colors"
                  >
                    <Target className="w-3.5 h-3.5 text-sky-400" />
                    <span>新建业务口径</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onNewAsset('note');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-monokai-fg-muted hover:bg-monokai-border hover:text-amber-400 text-left transition-colors"
                  >
                    <BookMarked className="w-3.5 h-3.5 text-amber-400" />
                    <span>新建知识笔记</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-monokai-comment px-0.5">
          <span>共找→ {assets.length} 项资</span>
          {searchQuery && (
            <span className="text-monokai-accent truncate max-w-[140px]">
              包含 &quot;{searchQuery}&quot;
            </span>
          )}
        </div>
      </div>

      {/* 资产卡片列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {assets.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-monokai-comment">
            <p className="text-xs">未找到匹配的资产</p>
            <p className="text-[10px] text-monokai-comment mt-1">尝试更换搜索词或选择其他分类</p>
          </div>
        ) : (
          assets.map((asset) => {
            const isSelected = selectedAssetId === asset.id;
            const meta = getAssetMeta(asset);
            const title = asset.type === 'metric' ? asset.name : asset.title;

            return (
              <div
                key={asset.id}
                onClick={() => onSelectAsset(asset.id)}
                className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-monokai-elevated border-monokai-accent shadow-sm'
                    : 'bg-monokai-surface border-monokai-border/60 hover:border-monokai-border hover:bg-monokai-hover'
                }`}
              >
                {/* 顶部标签与收藏按钮*/}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${meta.badgeClass}`}
                  >
                    <meta.icon className="w-2.5 h-2.5" />
                    {meta.badgeText}
                  </span>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-monokai-comment font-mono flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(asset.updatedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => onToggleFavorite(asset.id, e)}
                      title={asset.isFavorite ? '取消收藏' : '收藏'}
                      className={`p-1 rounded hover:bg-black/20 transition-colors ${
                        asset.isFavorite
                          ? 'text-yellow-400'
                          : 'text-monokai-comment hover:text-monokai-comment opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Star
                        className={`w-3 h-3 ${asset.isFavorite ? 'fill-yellow-400' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* 标题 */}
                <h3
                  className={`text-xs font-medium leading-snug line-clamp-1 mb-1 ${
                    isSelected ? 'text-monokai-fg' : 'text-monokai-fg-muted group-hover:text-monokai-fg'
                  }`}
                >
                  {title}
                </h3>

                {/* 简述摘*/}
                <p className="text-[11px] text-monokai-comment line-clamp-2 leading-relaxed mb-2">
                  {meta.snippet || '暂无描述'}
                </p>

                {/* 底部 Tags */}
                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.2 rounded bg-monokai-bg text-monokai-comment border border-monokai-border/50 font-mono"
                      >
                        #{tag}
                      </span>
                    ))}
                    {asset.tags.length > 3 && (
                      <span className="text-[9px] text-monokai-comment">
                        +{asset.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
