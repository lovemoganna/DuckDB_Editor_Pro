import React, { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { CodeSnippet, getAllSnippets, deleteSnippet, searchSnippets, getAllTags } from '../../services/codeSnippetsStorage';

interface CodeSnippetsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTutorial?: (tutorialId: string) => void;
  onTryCode?: (code: string) => void;
}

export const CodeSnippetsSidebar: React.FC<CodeSnippetsSidebarProps> = ({
  isOpen,
  onClose,
  onSelectTutorial,
  onTryCode
}) => {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);

  // 加载代码片段
  const loadSnippets = async () => {
    try {
      let results: CodeSnippet[];
      if (searchQuery.trim()) {
        results = await searchSnippets(searchQuery);
      } else if (selectedTag) {
        // 手动过滤标签
        const all = await getAllSnippets();
        results = all.filter(s => s.tags.includes(selectedTag));
      } else {
        results = await getAllSnippets();
      }
      setSnippets(results);

      // 加载所有标签
      const tags = await getAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('加载代码片段失败:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnippets();
    }
  }, [isOpen, searchQuery, selectedTag]);

  // 复制代码
  const handleCopy = async (snippet: CodeSnippet) => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 删除代码片段
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个代码片段吗？')) return;
    try {
      await deleteSnippet(id);
      await loadSnippets();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 在编辑器中打开
  const handleOpenInEditor = (code: string) => {
    onTryCode?.(code);
    onClose();
  };

  // 跳转到教程
  const handleGoToTutorial = (tutorialId: string) => {
    onSelectTutorial?.(tutorialId);
    onClose();
  };

  // 清除筛选
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      <div className={`fixed inset-y-0 right-0 w-96 bg-[#21222c] border-l border-monokai-accent/30 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-accent/30 bg-[#282a36]/50">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <span className="i-lucide-code w-4 h-4 text-monokai-blue" />
            代码片段
            <span className="text-[10px] text-monokai-comment font-normal ml-1">({snippets.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 rounded hover:bg-monokai-accent/20"
          >
            <span className="i-lucide-x w-5 h-5" />
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="p-3 border-b border-monokai-accent/20 bg-[#21222c]/80">
          <div className="relative mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索代码片段..."
              className="w-full bg-monokai-bg border border-monokai-accent/50 rounded-lg px-3 py-2 text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg"
              >
                <span className="i-lucide-x w-4 h-4" />
              </button>
            )}
          </div>

          {/* 标签筛选 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedTag(null)}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  selectedTag === null
                    ? 'bg-monokai-blue text-white'
                    : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                }`}
              >
                全部
              </button>
              {allTags.slice(0, 8).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    selectedTag === tag
                      ? 'bg-monokai-blue text-white'
                      : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {allTags.length > 8 && (
                <span className="text-[10px] text-monokai-comment self-center">
                  +{allTags.length - 8}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 代码片段列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {snippets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-monokai-comment py-8">
              <div className="w-16 h-16 rounded-full bg-monokai-blue/10 flex items-center justify-center mb-3">
                <span className="i-lucide-code w-8 h-8 text-monokai-blue/50" />
              </div>
              <p className="text-sm font-medium">暂无代码片段</p>
              <p className="text-xs mt-1 opacity-60">点击 SQL 代码块上的心形图标添加收藏</p>
            </div>
          ) : (
            snippets.map(snippet => (
              <div
                key={snippet.id}
                className="bg-[#282a36]/50 rounded-xl border border-monokai-accent/20 hover:border-monokai-blue/30 transition-all group"
              >
                {/* 头部信息 */}
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedSnippet(expandedSnippet === snippet.id ? null : snippet.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {/* 教程标题 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoToTutorial(snippet.tutorialId);
                        }}
                        className="text-[10px] text-monokai-blue hover:text-monokai-purple transition-colors flex items-center gap-1 mb-1"
                      >
                        <span className="i-lucide-file-text w-3 h-3" />
                        <span className="truncate">{snippet.tutorialTitle}</span>
                      </button>

                      {/* 描述 */}
                      {snippet.description && (
                        <p className="text-xs text-monokai-fg mb-2 line-clamp-2">
                          {snippet.description}
                        </p>
                      )}

                      {/* 标签 */}
                      {snippet.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {snippet.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-monokai-accent/20 text-monokai-comment"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(snippet);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          copiedId === snippet.id
                            ? 'text-monokai-green bg-monokai-green/10'
                            : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/10'
                        }`}
                        title="复制代码"
                      >
                        {copiedId === snippet.id ? (
                          <span className="i-lucide-check w-4 h-4" />
                        ) : (
                          <span className="i-lucide-copy w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleDelete(snippet.id, e)}
                        className="p-1.5 text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10 rounded transition-colors"
                        title="删除"
                      >
                        <span className="i-lucide-trash-2 w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 时间信息 */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-monokai-comment flex items-center gap-1">
                      <span className="i-lucide-clock w-3 h-3" />
                      {new Date(snippet.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-monokai-comment">
                      {expandedSnippet === snippet.id ? '收起 ▲' : '展开 ▼'}
                    </span>
                  </div>
                </div>

                {/* 代码预览区域 */}
                {expandedSnippet === snippet.id && (
                  <div className="border-t border-monokai-accent/20 p-2 bg-[#21222c]/50">
                    <div className="rounded overflow-hidden border border-monokai-accent/30">
                      <CodeMirror
                        value={snippet.code}
                        extensions={[sql()]}
                        theme={dracula}
                        editable={false}
                        basicSetup={{
                          lineNumbers: true,
                          foldGutter: false,
                          highlightActiveLine: false
                        }}
                        className="text-xs max-h-40"
                      />
                    </div>

                    {/* 在编辑器中打开按钮 */}
                    {onTryCode && (
                      <button
                        onClick={() => handleOpenInEditor(snippet.code)}
                        className="mt-2 w-full py-2 bg-monokai-green/10 hover:bg-monokai-green/20 border border-monokai-green/30 rounded-lg text-monokai-green text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span className="i-lucide-play w-3.5 h-3.5" />
                        在编辑器中运行
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 统计 */}
        <div className="p-3 border-t border-monokai-accent/30 text-xs text-monokai-comment flex justify-between">
          <span>共收藏 {snippets.length} 个代码片段</span>
          {(searchQuery || selectedTag) && (
            <button
              onClick={clearFilters}
              className="text-monokai-blue hover:underline"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default CodeSnippetsSidebar;
