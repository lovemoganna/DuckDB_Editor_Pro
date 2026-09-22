import React, { useState, useEffect } from 'react';
import { Heart, X, Folder, Clock } from 'lucide-react';
import { Favorite, getAllFavorites, removeFavorite } from '../../services/favoritesStorage';

interface FavoritesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTutorial?: (tutorialId: string) => void;
}

export const FavoritesSidebar: React.FC<FavoritesSidebarProps> = ({ 
  isOpen, 
  onClose, 
  onSelectTutorial 
}) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // 加载收藏
  const loadFavorites = async () => {
    try {
      const allFavorites = await getAllFavorites();
      setFavorites(allFavorites);
    } catch (error) {
      console.error('加载收藏失败:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFavorites();
    }
  }, [isOpen]);

  // 移除收藏
  const handleRemove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeFavorite(id);
      await loadFavorites();
    } catch (error) {
      console.error('移除收藏失败:', error);
    }
  };

  // 点击教程跳转
  const handleClick = (tutorialId: string) => {
    onSelectTutorial?.(tutorialId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs"
          onClick={onClose}
        />
      )}
      
      <div data-learn-sidebar role="dialog" aria-modal="true" aria-label="教程辅助侧栏" className={`fixed inset-y-0 right-0 w-80 max-w-full bg-monokai-sidebar border-l border-monokai-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-border bg-monokai-sidebar shrink-0">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <Heart className="w-4 h-4 text-monokai-pink fill-monokai-pink/20" />
            <span>我的收藏</span>
            <span className="text-[10px] text-monokai-comment font-mono ml-1">({favorites.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 rounded-md hover:bg-monokai-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 收藏列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-monokai-bg">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-monokai-comment py-8">
              <div className="w-12 h-12 rounded-full bg-monokai-pink/10 flex items-center justify-center mb-3">
                <Heart className="w-6 h-6 text-monokai-pink/60" />
              </div>
              <p className="text-xs font-medium">暂无收藏</p>
              <p className="text-[11px] mt-1 opacity-60">点击教程卡片上的心形图标添加收藏</p>
            </div>
          ) : (
            favorites.map(fav => (
              <div
                key={fav.id}
                onClick={() => handleClick(fav.tutorialId)}
                className="bg-monokai-surface rounded-xl p-3 border border-monokai-border hover:border-monokai-pink/40 transition-all group cursor-pointer shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* 教程标题 */}
                    <h4 className="text-xs font-medium text-monokai-fg truncate mb-1 group-hover:text-monokai-yellow transition-colors">
                      {fav.tutorialTitle}
                    </h4>
                    
                    {/* 分类标签 */}
                    {fav.tutorialCategory && (
                      <div className="flex items-center gap-1.5 text-[10px] text-monokai-blue mb-2 font-mono">
                        <Folder className="w-3 h-3" />
                        <span>{fav.tutorialCategory}</span>
                      </div>
                    )}
                    
                    {/* 添加时间 */}
                    <div className="flex items-center gap-1 text-[10px] text-monokai-comment font-mono">
                      <Clock className="w-3 h-3" />
                      <span>收藏于 {new Date(fav.addedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => handleRemove(fav.id, e)}
                    className="p-1.5 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="取消收藏"
                  >
                    <Heart className="w-3.5 h-3.5 fill-monokai-pink text-monokai-pink" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 统计 */}
        <div className="p-3 border-t border-monokai-border bg-monokai-sidebar text-xs text-monokai-comment font-mono shrink-0">
          共收藏 {favorites.length} 个教程
        </div>
      </div>
    </>
  );
};

export default FavoritesSidebar;
