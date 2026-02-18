import React, { useState, useMemo, useCallback } from 'react';
import { tutorials, searchTutorials, TutorialMetadata, SearchResult } from '../../data/tutorials';

interface WikiSearchProps {
  onSelectTutorial: (tutorial: TutorialMetadata) => void;
}

export const WikiSearch: React.FC<WikiSearchProps> = ({ onSelectTutorial }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 搜索结果
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchTutorials(query);
  }, [query]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelectTutorial(results[selectedIndex]);
          setQuery('');
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, results, selectedIndex, onSelectTutorial]);

  // 处理选择
  const handleSelect = (tutorial: TutorialMetadata) => {
    onSelectTutorial(tutorial);
    setQuery('');
    setIsOpen(false);
  };

  // 高亮匹配文本
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-monokai-yellow/40 text-monokai-yellow rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-monokai-green/20 text-monokai-green';
      case 'Intermediate': return 'bg-monokai-orange/20 text-monokai-orange';
      case 'Advanced': return 'bg-monokai-purple/20 text-monokai-purple';
      default: return 'bg-monokai-blue/20 text-monokai-blue';
    }
  };

  return (
    <div className="relative">
      {/* 搜索输入框 */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="搜索教程内容、标题、标签..."
          className="w-full bg-monokai-sidebar/50 border border-monokai-accent rounded-lg px-4 py-2.5 text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-comment">
          {query ? '🔍' : '⌘K'}
        </span>
      </div>

      {/* 搜索结果下拉 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-monokai-sidebar border border-monokai-accent rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
          {results.length > 0 ? (
            <>
              <div className="p-2 border-b border-monokai-accent/30 flex justify-between items-center">
                <span className="text-xs text-monokai-comment">
                  找到 {results.length} 个结果
                </span>
                <span className="text-[10px] text-monokai-comment/50">
                  支持全文搜索
                </span>
              </div>
              {results.map((tutorial, index) => (
                <button
                  key={tutorial.id}
                  onClick={() => handleSelect(tutorial)}
                  className={`w-full text-left p-3 border-b border-monokai-accent/20 last:border-0 transition-colors ${index === selectedIndex
                      ? 'bg-monokai-blue/20'
                      : 'hover:bg-monokai-accent/20'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-sm font-medium text-monokai-fg truncate">
                        {highlightMatch(tutorial.title, query)}
                      </span>
                      {tutorial.matchType === 'content' && <span className="text-[10px] bg-monokai-accent/30 text-monokai-comment px-1 rounded shrink-0">内容匹配</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${getDifficultyColor(tutorial.difficulty)}`}>
                      {tutorial.difficulty === 'Beginner' ? '入门' :
                        tutorial.difficulty === 'Intermediate' ? '进阶' :
                          tutorial.difficulty === 'Advanced' ? '高级' : '专家'}
                    </span>
                  </div>

                  {tutorial.matchingExcerpt ? (
                    <p className="text-xs text-monokai-comment/80 font-mono bg-monokai-bg/30 p-1.5 rounded mt-1 border-l-2 border-monokai-yellow/30">
                      {highlightMatch(tutorial.matchingExcerpt, query)}
                    </p>
                  ) : (
                    <p className="text-xs text-monokai-comment line-clamp-2">
                      {highlightMatch(tutorial.description, query)}
                    </p>
                  )}

                  <div className="flex gap-1 mt-1 flex-wrap">
                    {tutorial.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className={`text-xs px-1.5 py-0.5 rounded ${tutorial.matchType === 'tag' && tag.toLowerCase().includes(query.toLowerCase()) ? 'text-monokai-yellow bg-monokai-yellow/10' : 'text-monokai-comment bg-monokai-accent/20'}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </>
          ) : query.trim() ? (
            <div className="p-4 text-center">
              <p className="text-sm text-monokai-comment">没有找到匹配的教程</p>
              <p className="text-xs text-monokai-comment mt-1">试试其他关键词</p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs text-monokai-comment mb-2">快速开始</p>
              {tutorials.slice(0, 3).map(tutorial => (
                <button
                  key={tutorial.id}
                  onClick={() => handleSelect(tutorial)}
                  className="w-full text-left p-2 hover:bg-monokai-accent/20 rounded text-sm text-monokai-fg"
                >
                  {tutorial.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 点击外部关闭 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default WikiSearch;
